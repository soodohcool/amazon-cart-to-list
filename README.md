# Amazon Cart to List

Tampermonkey userscript that adds an **Add to list…** dropdown to every item on the [Amazon cart page](https://www.amazon.com/cart). Pick a list and the item goes straight there, no detour through "Save for later".

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or Violentmonkey).
2. Click to install: [amazon-cart-to-list.user.js](https://raw.githubusercontent.com/soodohcool/amazon-cart-to-list/main/amazon-cart-to-list.user.js)
3. Open your cart. Each item gets a dropdown next to Delete / Save for later.

Updates come through automatically via the `@updateURL` in the script header.

## How it works

- Pulls your full set of lists from `/hz/wishlist/ls` on page load (also grabs the wishlist CSRF token from that page, since cart page tokens are scoped to cart endpoints).
- On select, POSTs the item's ASIN to `/hz/wishlist/additemtolist` using your logged-in session.
- On success the dropdown is replaced with `In list: <list name>` linking to the list. Works for both "added" and "already in that list".
- Watches the cart for re-renders so dropdowns survive quantity changes and deletes.

Only runs on `amazon.com`. No data leaves Amazon.

## License

MIT
