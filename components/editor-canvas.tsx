"use client"

import { useRef, useEffect, forwardRef, useImperativeHandle } from "react"

interface EditorCanvasProps {
  image: string
  brightness: number
  contrast: number
  saturation: number
  filter: string
}

export const EditorCanvas = forwardRef<HTMLCanvasElement | null, EditorCanvasProps>(
  ({ image, brightness, contrast, saturation, filter }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Forward the canvas ref to parent components
    useImperativeHandle(ref, () => canvasRef.current)

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = image

      img.onload = () => {
        // Set canvas dimensions to match image
        canvas.width = img.width
        canvas.height = img.height

        // Draw the original image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // Apply adjustments
        applyAdjustments(ctx, canvas, brightness, contrast, saturation, filter)
      }
    }, [image, brightness, contrast, saturation, filter])

    const applyAdjustments = (
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      brightness: number,
      contrast: number,
      saturation: number,
      filter: string,
    ) => {
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      // Convert percentage values to actual factors
      const brightnessF = brightness / 100
      const contrastF = contrast / 100
      const saturationF = saturation / 100

      // Apply adjustments to each pixel
      for (let i = 0; i < data.length; i += 4) {
        // Apply brightness
        data[i] = data[i] * brightnessF
        data[i + 1] = data[i + 1] * brightnessF
        data[i + 2] = data[i + 2] * brightnessF

        // Apply contrast
        data[i] = (data[i] - 128) * contrastF + 128
        data[i + 1] = (data[i + 1] - 128) * contrastF + 128
        data[i + 2] = (data[i + 2] - 128) * contrastF + 128

        // Apply saturation
        const gray = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        data[i] = gray * (1 - saturationF) + data[i] * saturationF
        data[i + 1] = gray * (1 - saturationF) + data[i + 1] * saturationF
        data[i + 2] = gray * (1 - saturationF) + data[i + 2] * saturationF
      }

      // Apply filters
      if (filter === "grayscale") {
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
          data[i] = gray
          data[i + 1] = gray
          data[i + 2] = gray
        }
      } else if (filter === "sepia") {
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189)
          data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168)
          data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131)
        }
      } else if (filter === "vintage") {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = data[i] * 1.1
          data[i + 2] = data[i + 2] * 0.9
        }
      } else if (filter === "cool") {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = data[i] * 0.9
          data[i + 2] = data[i + 2] * 1.1
        }
      } else if (filter === "warm") {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = data[i] * 1.1
          data[i + 1] = data[i + 1] * 1.05
          data[i + 2] = data[i + 2] * 0.9
        }
      } else if (filter === "dramatic") {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] * 1.2)
          data[i + 1] = Math.min(255, data[i + 1] * 1.1)
          data[i + 2] = Math.min(255, data[i + 2] * 1.3)
        }
      }

      // Put the modified image data back
      ctx.putImageData(imageData, 0, 0)
    }

    return (
      <div className="max-w-full max-h-[70vh] overflow-auto flex items-center justify-center">
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
      </div>
    )
  },
)

EditorCanvas.displayName = "EditorCanvas"

