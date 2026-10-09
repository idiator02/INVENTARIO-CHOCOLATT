const paths = {
  transfer: <><path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  box: <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5Z" /><path d="m3 8 9 5 9-5M12 13v9M7.5 5.5l9 5" /></>,
  check: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v4H9zM8 14l3 3 5-6" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  bottle: <><path d="M9 3h6M10 3v5l-3 4v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-8l-3-4V3M7 14h10" /></>,
  cup: <><path d="m6 7 2 14h8l2-14H6ZM13 7l2-5h4M5 7h14" /></>,
  layers: <><path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></>,
  edit: <><path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v1" /></>,
  undo: <><path d="M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12" /></>,
  wifi: <><path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0" /><circle cx="12" cy="20" r=".5" /></>,
};
export default function Icon({ name, size = 20, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.box}</svg>;
}
