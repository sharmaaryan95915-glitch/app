# Pay&Serve — Website

This is a static website with no build step. Open `index.html` in a browser, or upload the folder to any web host.

```
website/
├── index.html      Home
├── about.html      About Us
├── services.html   Services (with category filters)
├── partner.html    Retailer / Distributor / Master Distributor
├── contact.html    Contact form, address, map
├── css/style.css   All styles, including day and night themes
├── js/main.js      Theme toggle, sounds, animations
└── assets/         Logo and favicon
```

## Features
- **Day / Night theme**: the moon/sun button switches themes with a circular wipe. The choice is saved, and the site follows the device setting by default.
- **Sounds**: the Web Audio API generates soft click, hover, toggle and success sounds, so there are no audio files. The speaker button mutes them, and that choice is saved.
- **Animations**: intro logo reveal, scroll reveals, staggered cards, a cursor spotlight on cards, 3D tilt on the hero, ripple buttons, counters, a marquee and a scroll progress bar. All animations turn off for users who choose reduced motion.

## Before going live
- In `contact.html`, replace the placeholder phone number and check the email address. Search for `TODO`.
- The forms only work in the browser. Connect them to your backend or an email service in `js/main.js` (see `form[data-demo]`).
