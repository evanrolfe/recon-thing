import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { FlowDetail } from './pages/FlowDetail'
import { Notifications } from './pages/Notifications'
import { PageDetail } from './pages/PageDetail'
import { TargetDetail } from './pages/TargetDetail'
import { TargetsIndex } from './pages/TargetsIndex'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<TargetsIndex />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/targets/:targetId" element={<TargetDetail />} />
          <Route path="/targets/:targetId/flows/:flowId" element={<FlowDetail />} />
          <Route path="/targets/:targetId/pages/:pageId" element={<PageDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
