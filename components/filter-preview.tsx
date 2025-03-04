"use client"

import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface FilterPreviewProps {
  filter: {
    id: string
    name: string
  }
  image: string
  isSelected: boolean
  onSelect: () => void
}

export function FilterPreview({ filter, image, isSelected, onSelect }: FilterPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = image

    img.onload = () => {
      // Set canvas dimensions
      canvas.width = 80
      canvas.height = 80

      // Calculate aspect ratio to maintain proportions
      const aspectRatio = img.width / img.height
      let drawWidth = canvas.width
      let drawHeight = canvas.width / aspectRatio

      if (drawHeight > canvas.height) {
        drawHeight = canvas.height
        drawWidth = canvas.height * aspectRatio
      }

      // Center the image
      const x = (canvas.width - drawWidth) / 2
      const y = (canvas.height - drawHeight) / 2

      // Draw the image
      ctx.drawImage(img, x, y, drawWidth, drawHeight)

      // Apply filter
      applyFilter(ctx, canvas, filter.id)
    }
  }, [image, filter.id])

  const applyFilter = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, filterId: string) => {
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Apply filters
    if (filterId === "grayscale") {
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        data[i] = gray
        data[i + 1] = gray
        data[i + 2] = gray
      }
    } else if (filterId === "sepia") {
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189)
        data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168)
        data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131)
      }
    } else if (filterId === "vintage") {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = data[i] * 1.1
        data[i + 2] = data[i + 2] * 0.9
      }
    } else if (filterId === "cool") {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = data[i] * 0.9
        data[i + 2] = data[i + 2] * 1.1
      }
    } else if (filterId === "warm") {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = data[i] * 1.1
        data[i + 1] = data[i + 1] * 1.05
        data[i + 2] = data[i + 2] * 0.9
      }
    } else if (filterId === "dramatic") {
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
    <div
      className={cn(
        "flex flex-col items-center cursor-pointer",
        isSelected && "opacity-100",
        !isSelected && "opacity-80 hover:opacity-100",
      )}
      onClick={onSelect}
    >
      <div
        className={cn(
          "w-20 h-20 rounded-md overflow-hidden mb-1 border-2",
          isSelected ? "border-primary" : "border-transparent",
        )}
      >
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
      <span className="text-xs">{filter.name}</span>
    </div>
  )
}

