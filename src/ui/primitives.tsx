import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Panel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={
        'rounded-2xl border border-white/10 bg-panel shadow-float backdrop-blur-[18px] ' +
        className
      }
    >
      {children}
    </div>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  label?: string
}

export function IconButton({
  active = false,
  label,
  className = '',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={
        'flex items-center justify-center rounded-xl transition-colors ' +
        'text-white/70 hover:text-white hover:bg-white/10 ' +
        'disabled:opacity-30 disabled:hover:bg-transparent ' +
        (active ? 'bg-white/15 text-white ring-1 ring-white/20 ' : '') +
        className
      }
      {...rest}
    >
      {children}
    </button>
  )
}
