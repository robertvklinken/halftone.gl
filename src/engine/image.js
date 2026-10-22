// Source images for image mode. Everything ends up on a canvas (downscaled to
// MAX_SIZE), which the engine uploads as a texture. The last image is kept in
// local storage so a reload doesn't lose it.

const MAX_SIZE = 2048
const STORE_KEY = 'halftone.gl:image'
const STORE_SIZE = 1600

function toCanvas(img, max = MAX_SIZE) {
  const k = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  return c
}

function decode(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = src
  })
}

export async function imageFromFile(file) {
  const url = URL.createObjectURL(file)
  try {
    const canvas = toCanvas(await decode(url))
    storeImage(canvas)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

function storeImage(canvas) {
  try {
    localStorage.setItem(STORE_KEY, toCanvas(canvas, STORE_SIZE).toDataURL('image/jpeg', 0.9))
  } catch {
    // storage full or blocked: the image just won't survive a reload
  }
}

export async function storedImage() {
  try {
    const data = localStorage.getItem(STORE_KEY)
    return data ? toCanvas(await decode(data)) : null
  } catch {
    return null
  }
}

// Shown until an image is loaded: a dusk sky with dark hills and a figure,
// so the dark- and light-area targets have something to find.
export function placeholderImage() {
  const S = 1024
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')

  const sky = ctx.createLinearGradient(0, 0, 0, S)
  sky.addColorStop(0, '#6f8fb8')
  sky.addColorStop(0.55, '#e9b08a')
  sky.addColorStop(1, '#f3d9b5')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, S, S)

  const sun = ctx.createRadialGradient(S * 0.68, S * 0.5, 0, S * 0.68, S * 0.5, S * 0.22)
  sun.addColorStop(0, 'rgba(255, 244, 220, 1)')
  sun.addColorStop(1, 'rgba(255, 244, 220, 0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, S, S)

  const hill = (color, y, amp, phase) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, S)
    for (let x = 0; x <= S; x += 8) ctx.lineTo(x, y + Math.sin(x / S * 5 + phase) * amp + Math.sin(x / S * 13 + phase) * amp * 0.3)
    ctx.lineTo(S, S)
    ctx.fill()
  }
  hill('#5d4a5c', S * 0.66, S * 0.04, 1)
  hill('#2c2430', S * 0.76, S * 0.05, 3)

  // a standing figure on the near hill
  ctx.fillStyle = '#141016'
  ctx.beginPath()
  ctx.arc(S * 0.3, S * 0.5, S * 0.035, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.roundRect(S * 0.255, S * 0.54, S * 0.09, S * 0.24, S * 0.04)
  ctx.fill()

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.font = `${S * 0.022}px "Space Mono", monospace`
  ctx.textAlign = 'center'
  ctx.fillText('DROP, PASTE OR LOAD AN IMAGE', S / 2, S * 0.12)
  return c
}
