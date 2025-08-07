import { useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { 
  FiSearch, 
  FiCode,           // For AI Developer
  FiShield,         // For AI Tester
  FiCheckSquare, 
  FiChevronDown, 
  FiChevronRight,
  FiTerminal,       // For code generator
  FiDatabase,       // For database designer
  FiGitBranch,      // For code review
  FiSettings,       // For API builder
  FiTarget,         // For test automation
  FiAlertTriangle,  // For bug detector (replacing FiBug)
  FiActivity,       // For performance tester
  FiCompass,        // For discovery agent
  FiFileText,       // For user stories
  FiLayers          // For functional stories
} from 'react-icons/fi';

const menuItems = [
  { 
    key: 'discovery', 
    label: 'AI Discovery Agent', 
    icon: <FiCompass />,  // Compass icon for discovery/exploration
    subItems: [
      { key: 'requirement-discovery', label: 'Requirement Discovery', href: '/discovery/requirement-discovery', icon: <FiSearch /> },
      { key: 'business-analysis', label: 'Business Analysis', href: '/discovery/business-analysis', icon: <FiTarget /> },
      { key: 'stakeholder-mapping', label: 'Stakeholder Mapping', href: '/discovery/stakeholder-mapping', icon: <FiDatabase /> }
    ]
  },
  { 
    key: 'userstory', 
    label: 'AI User Story', 
    icon: <FiFileText />,  // Document icon for user stories
    subItems: [
      { key: 'functional-story', label: 'Functional User Story', href: '/userstory/functional-story', icon: <FiLayers /> },
      { key: 'technical-story', label: 'Technical User Story', href: '/userstory/technical-story', icon: <FiSettings /> }
    ]
  },  
 { 
    key: 'developer', 
    label: 'AI Developer', 
    icon: <FiCode />,  // Code icon for development
    href: '/developer'  // Add direct href since there are no subItems
  },
  { 
    key: 'tester', 
    label: 'AI Tester', 
    icon: <FiShield />,  // Shield icon for testing/quality assurance
    subItems: [
      { key: 'test-generator', label: 'Test Case Generator', href: '/tester/test-generator', icon: <FiCheckSquare /> },
      { key: 'starter-script-generator', label: 'Starter Script Generator', href: '/tester/starter-script-generator', icon: <FiTerminal /> }
    ]
  }
];

const MenuLayout = () => {
  const [activeMenu, setActiveMenu] = useState('discovery'); // Changed from 'userstory' to 'discovery'
  const [hoveredMenu, setHoveredMenu] = useState(null);
  const navigate = useNavigate();

  const handleMenuClick = (key, href) => {
    setActiveMenu(key);
    if (href) {
      navigate(href);
    }
  };

  const handleSubItemClick = (parentKey, subKey, href) => {
    setActiveMenu(`${parentKey}-${subKey}`);
    if (href) {
      navigate(href);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar with blue gradient background */}
      <div className="w-64 bg-gradient-to-br from-blue-50 to-blue-100 text-gray-900 p-4 flex flex-col relative">
        {/* User Profile */}
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center mr-3 shadow-sm">
            <span className="text-lg font-bold text-blue-600">AI</span>
          </div>
          <div>
            <div className="font-semibold text-gray-800">SDLC Agent Hub</div>
            <div className="text-xs text-gray-600">powered by Mastek</div>
          </div>
        </div>
        
        {/* Menu Items */}
        <nav className="flex-1">
          {menuItems.map((item) => (
            <div 
              key={item.key} 
              className="mb-1 relative"
              onMouseEnter={() => item.subItems && setHoveredMenu(item.key)}
              onMouseLeave={() => setHoveredMenu(null)}
            >
              <button
                onClick={() => handleMenuClick(item.key, item.href)}
                className={`flex items-center justify-between w-full px-3 py-2 rounded text-left hover:bg-white/60 transition ${
                  activeMenu === item.key || activeMenu.startsWith(`${item.key}-`) 
                    ? 'bg-white/80 shadow font-semibold' 
                    : ''
                }`}
              >
                <div className="flex items-center">
                  <span className="mr-3 text-lg">{item.icon}</span>
                  {item.label}
                </div>
                {item.subItems && (
                  <span className="text-gray-400">
                    <FiChevronRight />
                  </span>
                )}
              </button>
              
              {/* Hover Submenu - appears on the right side with matching background */}
              {item.subItems && hoveredMenu === item.key && (
                <div 
                  className="absolute left-full top-0 w-64 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-lg border border-white/30 py-2 z-50"
                  onMouseEnter={() => setHoveredMenu(item.key)}
                  onMouseLeave={() => setHoveredMenu(null)}
                >
                  {/* Invisible bridge to prevent hover gap */}
                  <div className="absolute right-full top-0 w-2 h-full bg-transparent"></div>
                  
                  {/* Submenu Items */}
                  {item.subItems.map((subItem) => (
                    <button
                      key={subItem.key}
                      onClick={() => handleSubItemClick(item.key, subItem.key, subItem.href)}
                      className={`flex items-center w-full text-left px-4 py-2 text-sm hover:bg-white/60 transition ${
                        activeMenu === `${item.key}-${subItem.key}` 
                          ? 'bg-white/80 font-medium text-gray-800' 
                          : 'text-gray-700'
                      }`}
                    >
                      {subItem.icon && <span className="mr-3 text-base">{subItem.icon}</span>}
                      {subItem.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
      
      {/* Content area with light blue gradient matching test-generator */}
      <div className="flex-1 bg-gradient-to-br from-blue-50 to-blue-100 overflow-auto">
        <Outlet /> {/* This renders the nested route components */}
      </div>
    </div>
  );
};

export default MenuLayout;