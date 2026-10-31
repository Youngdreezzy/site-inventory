import './globals.css';
export const metadata = { title: 'Site Inventory', description: 'Materials delivered to and moved between sites' };
export const viewport = { width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
