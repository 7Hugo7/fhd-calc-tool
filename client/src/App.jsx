import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Verkaufskalkulation from './pages/Verkaufskalkulation';
import GarmentCalculation from './pages/GarmentCalculation';
import WarehousingCalculation from './pages/WarehousingCalculation';
import CalculationsList from './pages/CalculationsList';
import OffersList from './pages/OffersList';
import OfferDetail from './pages/OfferDetail';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('authToken');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={
          <ProtectedRoute>
            <Verkaufskalkulation />
          </ProtectedRoute>
        } />

        <Route path="/garment" element={
          <ProtectedRoute>
            <GarmentCalculation />
          </ProtectedRoute>
        } />

        <Route path="/garment/:id" element={
          <ProtectedRoute>
            <GarmentCalculation />
          </ProtectedRoute>
        } />

        <Route path="/warehousing" element={
          <ProtectedRoute>
            <WarehousingCalculation />
          </ProtectedRoute>
        } />

        <Route path="/warehousing/:id" element={
          <ProtectedRoute>
            <WarehousingCalculation />
          </ProtectedRoute>
        } />

        <Route path="/calculations" element={
          <ProtectedRoute>
            <CalculationsList />
          </ProtectedRoute>
        } />

        <Route path="/offers" element={
          <ProtectedRoute>
            <OffersList />
          </ProtectedRoute>
        } />

        <Route path="/offers/:id" element={
          <ProtectedRoute>
            <OfferDetail />
          </ProtectedRoute>
        } />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
