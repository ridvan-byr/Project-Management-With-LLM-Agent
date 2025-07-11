import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from './context/AuthContext'
import ClientLayout from './components/ClientLayout'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'LLM Agent',
  description: 'LLM Agent Project',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body className={inter.className + " bg-gray-50 dark:bg-gray-900 min-h-screen"}>
        <AuthProviderWrapper>
          <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
        </AuthProviderWrapper>
      </body>
    </html>
  )
}

// 👇 Server component içinden client component çağırmak için wrapper'lar
function AuthProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>{children}</AuthProvider>
  )
}

function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ClientLayout>{children}</ClientLayout>
  )
}
