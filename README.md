# Meme Generator

A meme maker that runs in the browser. Pick a template or upload your own image, type a caption, drag it where you want it, and download a PNG.

Live at **https://jackhomer.com/meme-generator/**

![The template picker and editor](https://jackhomer.com/screenshots/meme-generator.webp)

## What it does

Templates come from Imgflip's public list of the formats people actually use, searchable by name. The last five you opened move to the front of the grid. For anything not in the list, upload an image from your device.

Captions are objects on the canvas rather than fixed top-and-bottom slots. Add as many as you want. Each one has its own text over as many lines as you type, a size from 16 to 96, a color, left/center/right alignment, and a black outline you can switch off. Drag a caption on the image to move it. Text renders in Impact and uppercased, the way the format expects.

Download writes a PNG at the template's own pixel dimensions, with no watermark and no re-encoding. There is no sign-in anywhere in the app. Safari on iOS ignores the download attribute, so on an iPhone the finished image opens full screen instead, ready to long-press and save to Photos.

Uploaded images never leave the page, since there is no backend to send them to. Template images load from Imgflip, and page views plus a single "meme downloaded" event go to a cookieless Umami counter.

## Running it locally

```sh
npm install
npm run dev
```

`npm run build` type-checks and bundles into `dist/`. `npm run test` runs the Vitest suite covering the coordinate math and text layout. `npm run deploy` publishes `dist/` to the `gh-pages` branch, which is what GitHub Pages serves.

## Stack

React 19 and TypeScript on Vite. Drawing, hit-testing, and export are plain canvas 2D with no image library involved.

Write-up: https://jackhomer.com/projects/meme-maker/
