import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DataStoreProvider } from '@/hooks/useDataStore'
import { Dashboard } from '@/pages/Dashboard'
import { Employees } from '@/pages/Employees'
import { EmployeeProfile } from '@/pages/EmployeeProfile'
import { Submissions } from '@/pages/Submissions'

export default function App() {
  return (
    <DataStoreProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/employees/:id" element={<EmployeeProfile />} />
          <Route path="/submissions" element={<Submissions />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </DataStoreProvider>
  )
}
