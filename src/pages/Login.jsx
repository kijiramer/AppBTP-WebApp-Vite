import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Row, Col, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.message || 'Erreur de connexion');
      }
    } catch (err) {
      setError('Une erreur est survenue lors de la connexion');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement...</span>
        </div>
      </div>
    );
  }

  return (
    <Container fluid>
      <Row className="justify-content-center" style={{ minHeight: '100vh', alignItems: 'center' }}>
        <Col xs={12} sm={8} md={6} lg={4}>
          <div className="form-container">
            <div className="text-center mb-4">
              <h2 style={{ color: '#F85F6A', fontWeight: '700' }}>🏗️ AppBTP</h2>
              <p className="text-muted">Connectez-vous à votre compte</p>
            </div>

            {error && (
              <Alert variant="danger" className="mb-3">
                {error}
              </Alert>
            )}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Entrez votre email"
                  required
                  style={{ 
                    borderRadius: '8px',
                    padding: '12px 15px',
                    fontSize: '16px'
                  }}
                />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label>Mot de passe</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Entrez votre mot de passe"
                  required
                  style={{ 
                    borderRadius: '8px',
                    padding: '12px 15px',
                    fontSize: '16px'
                  }}
                />
              </Form.Group>

              <div className="d-grid mb-3">
                <Button 
                  variant="primary" 
                  type="submit" 
                  disabled={isLoading}
                  size="lg"
                  style={{
                    background: 'linear-gradient(135deg, #F85F6A 0%, #e74c3c 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 30px',
                    fontWeight: '600'
                  }}
                >
                  {isLoading ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                        className="me-2"
                      />
                      Connexion...
                    </>
                  ) : (
                    'Se connecter'
                  )}
                </Button>
              </div>

              <div className="text-center">
                <p className="mb-0">
                  Pas encore de compte ?{' '}
                  <Link to="/signup" style={{ color: '#F85F6A', textDecoration: 'none' }}>
                    S'inscrire
                  </Link>
                </p>
              </div>
            </Form>
          </div>
        </Col>
      </Row>
    </Container>
  );
}