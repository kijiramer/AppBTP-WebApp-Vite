import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Navbar, Nav, Dropdown } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export default function Dashboard() {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user && !loading) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    fetchCities();
  }, [token]);

  const fetchCities = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/cities`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setCities(response.data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des villes:', error);
      // Pour la demo, on crée des données fictives
      setCities([
        { name: 'Paris', id: 1 },
        { name: 'Lyon', id: 2 },
        { name: 'Marseille', id: 3 },
        { name: 'Toulouse', id: 4 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCityClick = (cityName) => {
    // Pour l'instant on reste sur le dashboard
    alert(`Navigation vers les chantiers de ${cityName} (à implémenter)`);
  };

  if (!user) {
    return (
      <div className="loading-container">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <Navbar 
        style={{
          background: 'linear-gradient(135deg, #F85F6A 0%, #e74c3c 100%)',
          position: 'fixed',
          top: 0,
          width: '100%',
          zIndex: 1000,
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}
        variant="dark"
        expand="lg"
      >
        <Container>
          <Navbar.Brand 
            style={{ fontWeight: '600', fontSize: '1.5rem' }}
          >
            🏗️ AppBTP
          </Navbar.Brand>
          
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link active>Accueil</Nav.Link>
              <Nav.Link onClick={() => alert('Notes (à implémenter)')}>Notes</Nav.Link>
              <Nav.Link onClick={() => alert('Effectifs (à implémenter)')}>Effectifs</Nav.Link>
            </Nav>
            
            <Nav>
              <Dropdown align="end">
                <Dropdown.Toggle 
                  as={Button} 
                  variant="outline-light"
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: 'white'
                  }}
                >
                  👤 {user.name || user.email}
                </Dropdown.Toggle>
                
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => alert('Profil (à implémenter)')}>
                    Profil
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={handleLogout}>
                    Se déconnecter
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {/* Contenu principal */}
      <Container fluid style={{ marginTop: '80px', padding: '20px', minHeight: 'calc(100vh - 80px)' }}>
        {/* Banner */}
        <Row className="mb-4">
          <Col>
            <div style={{
              height: '200px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #F85F6A 0%, #e74c3c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              marginBottom: '30px',
              textAlign: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '10px' }}>
                  Bienvenue dans votre application BTP
                </h2>
                <p style={{ fontSize: '1.2rem', opacity: '0.9' }}>
                  Voici la liste de vos chantiers par ville
                </p>
              </div>
            </div>
          </Col>
        </Row>

        {/* Message de bienvenue */}
        <Row className="mb-4">
          <Col>
            <h3>Bonjour {user.name || user.email} !</h3>
            <p className="text-muted">
              Sélectionnez une ville pour voir les chantiers disponibles
            </p>
          </Col>
        </Row>

        {/* Liste des villes */}
        <Row>
          <Col>
            {loading ? (
              <div className="loading-container">
                <Spinner animation="border" style={{ color: '#F85F6A' }} />
                <p className="mt-3">Chargement des villes...</p>
              </div>
            ) : error ? (
              <div className="text-center">
                <div className="alert alert-danger">{error}</div>
                <Button 
                  variant="primary" 
                  onClick={fetchCities}
                  style={{
                    background: 'linear-gradient(135deg, #F85F6A 0%, #e74c3c 100%)',
                    border: 'none'
                  }}
                >
                  Réessayer
                </Button>
              </div>
            ) : cities.length === 0 ? (
              <div className="text-center">
                <p className="text-muted">Aucune ville disponible</p>
              </div>
            ) : (
              <Row>
                {cities.map((city, index) => (
                  <Col key={index} xs={12} sm={6} md={4} lg={3} className="mb-3">
                    <Card 
                      className="city-card h-100"
                      onClick={() => handleCityClick(city.name)}
                      style={{ 
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0px)';
                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                      }}
                    >
                      <Card.Body className="d-flex flex-column align-items-center text-center">
                        <div style={{ color: '#F85F6A', marginBottom: '15px' }}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                          </svg>
                        </div>
                        <Card.Title style={{
                          fontSize: '1.2rem',
                          fontWeight: '600',
                          color: '#333',
                          marginBottom: '5px'
                        }}>
                          {city.name}
                        </Card.Title>
                        <Card.Text style={{ color: '#666', fontSize: '0.9rem' }}>
                          Cliquez pour voir les chantiers
                        </Card.Text>
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Col>
        </Row>
      </Container>
    </>
  );
}