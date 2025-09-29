import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import Storage from '../utils/storage';
import { API_BASE_URL } from '../config/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  const loadUser = async (authToken) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/user`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      
      if (response.data.user) {
        setUser(response.data.user);
        return response.data.user;
      }
      return null;
    } catch (error) {
      console.error('Erreur lors du chargement de l\'utilisateur:', error);
      await logout();
      return null;
    }
  };

  const login = async (email, password) => {
    try {
      setLoading(true);
      
      // Mode Demo - Connexion sans backend
      if (email === 'demo@appbtp.com' && password === 'demo') {
        const demoUser = {
          id: 1,
          name: 'Utilisateur Demo',
          email: 'demo@appbtp.com',
          company: 'AppBTP Demo'
        };
        const demoToken = 'demo-token-12345';
        
        Storage.setItem('token', demoToken);
        setToken(demoToken);
        setUser(demoUser);
        
        return { success: true, user: demoUser };
      }
      
      // Tentative de connexion au backend réel
      try {
        const response = await axios.post(`${API_BASE_URL}/login`, {
          email,
          password,
        });

        if (response.data.token) {
          const authToken = response.data.token;
          Storage.setItem('token', authToken);
          setToken(authToken);
          
          const userData = await loadUser(authToken);
          if (userData) {
            setUser(userData);
            return { success: true, user: userData };
          }
        }
        
        return { success: false, message: 'Échec de la connexion' };
      } catch (backendError) {
        // Si le backend n'est pas accessible, proposer le mode demo
        return { 
          success: false, 
          message: 'Backend non accessible. Utilisez demo@appbtp.com / demo pour tester l\'interface' 
        };
      }
      
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      return { 
        success: false, 
        message: 'Erreur de connexion. Utilisez demo@appbtp.com / demo pour tester' 
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/register`, userData);
      
      if (response.data.success) {
        return { success: true, message: 'Inscription réussie' };
      }
      
      return { success: false, message: 'Échec de l\'inscription' };
    } catch (error) {
      console.error('Erreur lors de l\'inscription:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Erreur d\'inscription' 
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      Storage.removeItem('token');
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  useEffect(() => {
    const checkToken = async () => {
      try {
        const savedToken = Storage.getItem('token');
        if (savedToken) {
          setToken(savedToken);
          await loadUser(savedToken);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du token:', error);
      } finally {
        setLoading(false);
      }
    };

    checkToken();
  }, []);

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    loadUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};