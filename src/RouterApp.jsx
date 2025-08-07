import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Home from './pages/Home.jsx';
import TestCaseGeneratorApp from './pages/tester/TestCaseGeneratorApp.jsx';
import StarterScriptGeneratorApp from './pages/tester/StarterScriptGeneratorApp.jsx';
import MenuLayout from './layouts/MenuLayout.jsx';

const RouterApp = () => (
  <Router>
    <Routes>
      {/* Make MenuLayout the home page */}
      <Route path="/" element={<MenuLayout />}>
        {/* Default route for / */}
        <Route index element={<div className="flex items-center justify-center h-full"><h1 className="text-4xl font-bold text-gray-800">Welcome to SDLC Agents portal</h1></div>} />
        
        {/* Developer routes */}
        <Route path="developer/code-generator" element={<div>Code Generator</div>} />
        <Route path="developer/api-builder" element={<div>API Builder</div>} />
        <Route path="developer/database-designer" element={<div>Database Designer</div>} />
        <Route path="developer/code-review" element={<div>Code Review</div>} />
        
        {/* Tester routes */}
        <Route path="tester/test-generator" element={<TestCaseGeneratorApp />} />
        <Route path="tester/starter-script-generator" element={<StarterScriptGeneratorApp />} />
        <Route path="tester/test-automation" element={<div>Test Automation</div>} />
        <Route path="tester/bug-detector" element={<div>Bug Detector</div>} />
        <Route path="tester/performance-tester" element={<div>Performance Tester</div>} />
        
        {/* Tasks route */}
        <Route path="tasks" element={<div>Tasks Page</div>} />
      </Route>
      
      {/* Move original Home to a different route if needed */}
      <Route path="/welcome" element={<Home />} />
      
      {/* Legacy routes for backward compatibility */}
      <Route path="/TestCaseGeneratorApp" element={<TestCaseGeneratorApp />} />
      <Route path="/StarterScriptGeneratorApp" element={<StarterScriptGeneratorApp />} />
    </Routes>
  </Router>
);

export default RouterApp;