declare global {
  namespace App {
    interface ValueConfig {
      rangeLow: number
      rangeHigh: number
      label: string
      digitCount: number
    }

    interface GroupConfig {
      groupId: number
      label: string
      values: ValueConfig[]
    }

    interface GroupRects {
      groupRect: DOMRect
      valueRects: DOMRect[]
    }

    interface ValueData {
      digitPos: number
      value: number | null
    }
  }
}

export {}