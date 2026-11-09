import './globals.css'

export const metadata = {
  title: 'Luma Call',
  description: 'Video call room',
}

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
