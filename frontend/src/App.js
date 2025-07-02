import React, { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth Provider
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Verify token and get user data
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get(`${API}/business/profile`);
      setBusiness(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile:', error);
      logout();
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token, user: userData, business: businessData } = response.data;
      
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      setUser(userData);
      setBusiness(businessData);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setBusiness(null);
  };

  const registerBusiness = async (businessData) => {
    try {
      const response = await axios.post(`${API}/auth/register-business`, businessData);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Registration failed' 
      };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      business,
      loading,
      login,
      logout,
      registerBusiness
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Components
const LoginForm = ({ onToggle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-md border border-white/20">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Enterprise SaaS</h1>
          <p className="text-blue-200">AI-Powered Business Automation</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-blue-100 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your email"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-blue-100 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onToggle}
            className="text-blue-300 hover:text-white transition duration-200"
          >
            Don't have a business account? Register here
          </button>
        </div>

        <div className="mt-8 text-center">
          <div className="text-xs text-blue-200 mb-2">Demo Credentials:</div>
          <div className="text-xs text-blue-300">
            <div>Super Admin: superadmin@platform.com / SuperAdmin@123</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const RegisterForm = ({ onToggle }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    domain: '',
    owner_email: '',
    owner_name: '',
    owner_username: '',
    owner_password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { registerBusiness } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const result = await registerBusiness(formData);
    if (result.success) {
      setSuccess('Business registration submitted! Awaiting Super Admin approval.');
      setFormData({
        name: '',
        description: '',
        domain: '',
        owner_email: '',
        owner_name: '',
        owner_username: '',
        owner_password: ''
      });
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-2xl border border-white/20">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Register Your Business</h1>
          <p className="text-blue-200">Join the Enterprise SaaS Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-blue-100 mb-2">Business Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Your Business Name"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-blue-100 mb-2">Domain (Optional)</label>
              <input
                type="text"
                name="domain"
                value={formData.domain}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="yourbusiness.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-100 mb-2">Business Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Describe your business..."
            />
          </div>

          <div className="border-t border-white/20 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4">Business Owner Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-blue-100 mb-2">Full Name</label>
                <input
                  type="text"
                  name="owner_name"
                  value={formData.owner_name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="John Doe"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-blue-100 mb-2">Username</label>
                <input
                  type="text"
                  name="owner_username"
                  value={formData.owner_username}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="johndoe"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <label className="block text-sm font-medium text-blue-100 mb-2">Email</label>
                <input
                  type="email"
                  name="owner_email"
                  value={formData.owner_email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="john@business.com"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-blue-100 mb-2">Password</label>
                <input
                  type="password"
                  name="owner_password"
                  value={formData.owner_password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Strong password"
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/20 border border-green-500/30 text-green-200 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Register Business'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onToggle}
            className="text-purple-300 hover:text-white transition duration-200"
          >
            Already have an account? Sign in here
          </button>
        </div>
      </div>
    </div>
  );
};

const SuperAdminDashboard = () => {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { logout } = useAuth();

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const response = await axios.get(`${API}/admin/businesses`);
      setBusinesses(response.data);
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBusinessAction = async (businessId, action) => {
    try {
      await axios.post(`${API}/admin/businesses/${businessId}/${action}`);
      fetchBusinesses(); // Refresh the list
    } catch (error) {
      console.error(`Error ${action} business:`, error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'suspended': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Super Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Platform Administrator</span>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Business Applications</h2>
            <p className="mt-1 text-sm text-gray-600">
              Manage business registrations and approvals
            </p>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {businesses.map((business) => (
                <li key={business.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {business.name}
                          </h3>
                          <p className="text-sm text-gray-500">{business.description}</p>
                          {business.domain && (
                            <p className="text-sm text-blue-600">{business.domain}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            Created: {new Date(business.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="ml-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(business.status)}`}>
                            {business.status.charAt(0).toUpperCase() + business.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-6 flex space-x-2">
                      {business.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleBusinessAction(business.id, 'approve')}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleBusinessAction(business.id, 'reject')}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {businesses.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No business applications yet.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const BusinessDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const { user, business, logout } = useAuth();

  useEffect(() => {
    fetchAnalytics();
    fetchContacts();
    fetchWorkflows();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API}/analytics/dashboard`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      const response = await axios.get(`${API}/crm/contacts`);
      setContacts(response.data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const response = await axios.get(`${API}/ai/workflows`);
      setWorkflows(response.data);
    } catch (error) {
      console.error('Error fetching workflows:', error);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'business_admin': return 'bg-purple-100 text-purple-800';
      case 'hr_manager': return 'bg-blue-100 text-blue-800';
      case 'sales_manager': return 'bg-green-100 text-green-800';
      case 'sales_executive': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRole = (role) => {
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                {business?.name || 'Business Dashboard'}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user?.role)}`}>
                {formatRole(user?.role || '')}
              </span>
              <span className="text-sm text-gray-500">{user?.full_name}</span>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              {['overview', 'crm', 'ai-automation', 'analytics'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
                </button>
              ))}
            </nav>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                          <span className="text-white font-semibold">C</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Contacts</dt>
                          <dd className="text-lg font-medium text-gray-900">{analytics?.total_contacts || 0}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                          <span className="text-white font-semibold">W</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">AI Workflows</dt>
                          <dd className="text-lg font-medium text-gray-900">{analytics?.total_workflows || 0}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                          <span className="text-white font-semibold">A</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Active Workflows</dt>
                          <dd className="text-lg font-medium text-gray-900">{analytics?.active_workflows || 0}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Welcome to Your Enterprise SaaS Platform</h3>
                <div className="prose text-gray-600">
                  <p>You're now part of the most advanced AI-powered business automation platform. Here's what you can do:</p>
                  <ul className="mt-4 space-y-2">
                    <li>• Manage unlimited contacts with AI-powered lead scoring</li>
                    <li>• Create automated workflows for sales, marketing, and operations</li>
                    <li>• Generate contracts and invoices with AI assistance</li>
                    <li>• Track comprehensive business analytics and insights</li>
                    <li>• White-label the platform with your own branding</li>
                  </ul>
                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> AI features require API keys to be configured. Contact your administrator to enable AI automation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CRM Tab */}
          {activeTab === 'crm' && (
            <div>
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Contact Management</h3>
                </div>
                <div className="p-6">
                  {contacts.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No contacts yet. Start building your customer database!</p>
                      <button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                        Add First Contact
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {contacts.map((contact) => (
                        <div key={contact.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {contact.first_name} {contact.last_name}
                              </h4>
                              {contact.email && (
                                <p className="text-sm text-gray-600">{contact.email}</p>
                              )}
                              {contact.company && (
                                <p className="text-sm text-gray-500">{contact.company}</p>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              Score: {contact.lead_score}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AI Automation Tab */}
          {activeTab === 'ai-automation' && (
            <div>
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">AI Workflows & Automation</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <span className="text-blue-600 font-bold">AI</span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-2">Smart Lead Scoring</h4>
                      <p className="text-sm text-gray-600 mb-4">AI-powered lead qualification and scoring</p>
                      <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                        Set Up
                      </button>
                    </div>

                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <span className="text-green-600 font-bold">📧</span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-2">Email Automation</h4>
                      <p className="text-sm text-gray-600 mb-4">Automated email sequences and follow-ups</p>
                      <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                        Create
                      </button>
                    </div>

                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <span className="text-purple-600 font-bold">📄</span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-2">Contract Generation</h4>
                      <p className="text-sm text-gray-600 mb-4">AI-generated contracts and agreements</p>
                      <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                        Generate
                      </button>
                    </div>
                  </div>

                  {workflows.length > 0 && (
                    <div className="mt-8">
                      <h4 className="font-medium text-gray-900 mb-4">Active Workflows</h4>
                      <div className="space-y-4">
                        {workflows.map((workflow) => (
                          <div key={workflow.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-medium text-gray-900">{workflow.name}</h5>
                                <p className="text-sm text-gray-600">{workflow.description}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Trigger: {workflow.trigger_type}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  workflow.is_active 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {workflow.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div>
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-6">Business Analytics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Performance Metrics</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">Total Contacts</span>
                        <span className="text-lg font-bold text-blue-600">{analytics?.total_contacts || 0}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">Active Workflows</span>
                        <span className="text-lg font-bold text-green-600">{analytics?.active_workflows || 0}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">Business Status</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          analytics?.business_status === 'approved' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {analytics?.business_status || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Quick Actions</h4>
                    <div className="space-y-3">
                      <button className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                        <div className="font-medium text-blue-900">Generate Report</div>
                        <div className="text-sm text-blue-700">Export business analytics</div>
                      </button>
                      <button className="w-full text-left p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                        <div className="font-medium text-green-900">AI Insights</div>
                        <div className="text-sm text-green-700">Get AI-powered recommendations</div>
                      </button>
                      <button className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
                        <div className="font-medium text-purple-900">Performance Review</div>
                        <div className="text-sm text-purple-700">Analyze business performance</div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <AuthProvider>
      <AuthenticatedApp showLogin={showLogin} setShowLogin={setShowLogin} />
    </AuthProvider>
  );
};

const AuthenticatedApp = ({ showLogin, setShowLogin }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return showLogin ? (
      <LoginForm onToggle={() => setShowLogin(false)} />
    ) : (
      <RegisterForm onToggle={() => setShowLogin(true)} />
    );
  }

  // Route based on user role
  if (user.role === 'super_admin') {
    return <SuperAdminDashboard />;
  } else {
    return <BusinessDashboard />;
  }
};

export default App;