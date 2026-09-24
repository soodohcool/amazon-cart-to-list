// ==UserScript==
// @name         Amazon Cart to List
// @namespace    https://github.com/soodohcool
// @version      1.0.0
// @description  Add items to a specific wish list right from the Amazon cart page instead of the dumb "Save for later" list
// @author       soodohcool
// @license      MIT
// @homepageURL  https://github.com/soodohcool/amazon-cart-to-list
// @supportURL   https://github.com/soodohcool/amazon-cart-to-list/issues
// @downloadURL  https://raw.githubusercontent.com/soodohcool/amazon-cart-to-list/main/amazon-cart-to-list.user.js
// @updateURL    https://raw.githubusercontent.com/soodohcool/amazon-cart-to-list/main/amazon-cart-to-list.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=amazon.com
// @match        https://www.amazon.com/cart*
// @match        https://www.amazon.com/gp/cart*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const LISTS_URL = 'https://www.amazon.com/hz/wishlist/ls';
  const ADD_URL = 'https://www.amazon.com/hz/wishlist/additemtolist';

  let csrfToken = null;
  let lists = null; // [{ id, name }]
  let listsPromise = null;
  let scheduled = false;

  function parse(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  // cart page tokens are scoped to cart endpoints, so we need the lists page's own token
  function tokenFrom(doc) {
    const el = doc.querySelector('#lists-sp-csrf-meta-token, #lists-sp-csrf-form-token, #lists-sp-csrf-input-token');
    return el ? (el.content || el.value) : null;
  }

  // one fetch gets both the list names and a usable token
  function loadLists() {
    if (listsPromise) return listsPromise;
    listsPromise = fetch(LISTS_URL, { credentials: 'include' })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        const doc = parse(html);
        csrfToken = tokenFrom(doc) || csrfToken;
        lists = Array.from(doc.querySelectorAll('a[id^="wl-list-link-"]')).map(function (a) {
          const id = a.id.replace('wl-list-link-', '');
          const title = doc.querySelector('#wl-list-entry-title-' + id);
          return { id: id, name: (title ? title.textContent : a.textContent).trim() };
        });
        return lists;
      })
      .catch(function () {
        listsPromise = null;
        return [];
      });
    return listsPromise;
  }

  async function getCsrfToken() {
    if (!csrfToken) await loadLists();
    return csrfToken;
  }

  function showInList(wrap, name, href) {
    wrap.textContent = 'In list: ';
    const a = document.createElement('a');
    a.className = 'a-link-normal';
    a.href = href;
    a.textContent = name;
    wrap.appendChild(a);
  }

  async function addToList(asin, listId, wrap, select) {
    select.disabled = true;
    try {
      const token = await getCsrfToken();
      if (!token) throw new Error('missing csrf');

      const res = await fetch(ADD_URL, {
        method: 'POST',
        credentials: 'include',
        headers: {
          accept: '*/*',
          'content-type': 'application/x-www-form-urlencoded',
          'anti-csrftoken-a2z': token,
          'x-requested-with': 'XMLHttpRequest',
        },
        body: new URLSearchParams({
          asin: asin,
          vendorId: 'website.wishlist.detail.add',
          listExternalId: listId,
          listType: 'wishlist',
          isAjax: '1',
        }),
      });

      // success is an html snippet ("1 item added to" or "already in ... List") with a fresh token
      const text = await res.text();
      if (!res.ok || !/item added to|already in/i.test(text)) throw new Error('add failed');
      const doc = parse(text);
      csrfToken = tokenFrom(doc) || csrfToken;

      const link = doc.querySelector('#huc-list-link');
      const fallback = lists.find(function (l) { return l.id === listId; });
      showInList(
        wrap,
        link ? link.textContent.trim() : (fallback ? fallback.name : listId),
        link ? link.getAttribute('href') : '/hz/wishlist/ls/' + listId
      );
    } catch (err) {
      csrfToken = null;
      select.disabled = false;
      select.value = '';
      const msg = document.createElement('span');
      msg.className = 'a-color-error';
      msg.textContent = ' Failed';
      wrap.appendChild(msg);
      setTimeout(function () { msg.remove(); }, 2000);
    }
  }

  function buildSelect(asin, wrap) {
    const select = document.createElement('select');
    // don't use a-native-dropdown, amazon's css hides it behind its own fake dropdown
    select.className = 'sc-add-to-list-select';
    select.setAttribute('aria-label', 'Add to list');

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Add to list…';
    select.appendChild(placeholder);

    lists.forEach(function (l) {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = l.name;
      select.appendChild(opt);
    });

    select.addEventListener('change', function () {
      if (select.value) addToList(asin, select.value, wrap, select);
    });
    return select;
  }

  function decorate(item) {
    if (item.querySelector('.sc-action-add-to-list')) return;
    const asin = item.getAttribute('data-asin');
    const actions = item.querySelector('.sc-action-links');
    if (!asin || !actions) return;

    const sep = document.createElement('i');
    sep.className = 'a-icon a-icon-text-separator sc-action-separator';
    sep.setAttribute('role', 'presentation');

    const wrap = document.createElement('span');
    wrap.className = 'a-size-small sc-action-add-to-list';
    wrap.appendChild(buildSelect(asin, wrap));

    actions.appendChild(sep);
    actions.appendChild(wrap);
  }

  function decorateAll() {
    if (!lists || !lists.length) return;
    const items = document.querySelectorAll('.sc-list-item[data-asin]');
    for (let i = 0; i < items.length; i++) decorate(items[i]);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      decorateAll();
    });
  }

  loadLists().then(decorateAll);
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
})();
