export function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" className="fill-brand-600" />
      <rect x="7" y="9" width="18" height="14" rx="2.5" fill="none" stroke="white" strokeWidth="2.2" />
      <path d="M11 14.5h10M11 18h6" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
