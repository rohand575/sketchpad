import type { SVGProps } from 'react'

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})

export const PenIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 20l3.5-1 9-9-2.5-2.5-9 9L4 20z" />
    <path d="M14 6.5L17.5 3 21 6.5 17.5 10" />
  </svg>
)

export const PencilIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 21l4-1L20 7l-3-3L4 17l-1 4z" />
    <path d="M15 6l3 3" />
  </svg>
)

export const MarkerIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 15l-3 4h5l2-2" />
    <path d="M11 13l4-9 4 2-3 9-5-2z" />
  </svg>
)

export const EraserIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 15l6-6 7 7-4 4H8l-4-4z" />
    <path d="M10 9l5-5 5 5-5 5" />
  </svg>
)

export const UndoIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 7L4 12l5 5" />
    <path d="M4 12h11a5 5 0 010 10h-1" />
  </svg>
)

export const RedoIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M15 7l5 5-5 5" />
    <path d="M20 12H9a5 5 0 000 10h1" />
  </svg>
)

export const LayersIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
)

export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
)

export const EyeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const EyeOffIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 3l18 18" />
    <path d="M10.6 6.1A9.8 9.8 0 0112 6c6 0 10 6 10 6a17 17 0 01-3 3.4M6.6 6.6A17 17 0 002 12s4 6 10 6a9.6 9.6 0 004-.9" />
  </svg>
)

export const HomeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v9h12v-9" />
  </svg>
)

export const DownloadIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 4v11m0 0l-4-4m4 4l4-4" />
    <path d="M4 19h16" />
  </svg>
)

export const CloudIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M7 18a4 4 0 010-8 5 5 0 019.6-1.3A3.5 3.5 0 1117 18H7z" />
  </svg>
)

export const SelectIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 3l7 17 2.5-6.5L21 11 5 3z" />
  </svg>
)

export const GoogleIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={18} height={18} viewBox="0 0 24 24" {...p}>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 002.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
    />
  </svg>
)
