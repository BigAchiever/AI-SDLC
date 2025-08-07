import React from 'react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-3xl font-bold">Welcome to the AI Based Automation</h1>
      
      <div className="flex gap-4 mt-6">
        <button
          onClick={() => navigate('/tester/starter-script-generator')}
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Starter Script Generation Solution
        </button>

        <button
          onClick={() => navigate('/tester/test-generator')}
          className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Test Case Generation Solution
        </button>
        
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          AI Portal Dashboard
        </button>
        
        <button
          onClick={() => window.open('https://dev.azure.com/', '_blank')}
          className="px-6 py-3 bg-gray-700 text-white rounded hover:bg-gray-800"
        >
          Open Azure DevOps
        </button>
      </div>
    </div>
  );
};

export default Home;