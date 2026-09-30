import { useEffect, useState } from 'react'

export interface DeviceInfo {
  /** Coarse pointer / touch-capable (tablets, phones). */
  isTouch: boolean
  /** Viewport narrower than the desktop breakpoint (tablets & phones). */
  isNarrow: boolean
  /** Small phone-sized viewport — triggers the bottom-dock layout. */
  isPhone: boolean
  width: number
  height: number
}

const PHONE_MAX = 640
const NARROW_MAX = 900

function read(): DeviceInfo {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280
  const h = typeof window !== 'undefined' ? window.innerHeight : 800
  const isTouch =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window)
  // Treat short-and-wide phones (landscape) as phones too.
  const isPhone = w < PHONE_MAX || (!!isTouch && Math.min(w, h) < PHONE_MAX)
  return {
    isTouch: !!isTouch,
    isNarrow: w < NARROW_MAX,
    isPhone,
    width: w,
    height: h,
  }
}

export function useDeviceType(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(read)
  useEffect(() => {
    const onResize = () => setInfo(read())
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    const mq = window.matchMedia('(pointer: coarse)')
    mq.addEventListener?.('change', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      mq.removeEventListener?.('change', onResize)
    }
  }, [])
  return info
}
