import { useEffect, useState } from 'react'

export interface DeviceInfo {
  /** Coarse pointer / touch-capable (tablets, phones). */
  isTouch: boolean
  /** Viewport narrower than the desktop breakpoint. */
  isNarrow: boolean
}

function read(): DeviceInfo {
  const isTouch =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window)
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 820
  return { isTouch: !!isTouch, isNarrow }
}

export function useDeviceType(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(read)
  useEffect(() => {
    const onResize = () => setInfo(read())
    window.addEventListener('resize', onResize)
    const mq = window.matchMedia('(pointer: coarse)')
    mq.addEventListener?.('change', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      mq.removeEventListener?.('change', onResize)
    }
  }, [])
  return info
}
