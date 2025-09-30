import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Row, 
  Col, 
  Card, 
  Button, 
  Form, 
  Spinner, 
  Alert,
  Modal,
  Image,
  Navbar, 
  Nav, 
  Dropdown 
} from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { jsPDF } from 'jspdf';
import './RapportPhoto.css';

// Fix: Using named import for jsPDF v2.5.2 compatibility
export default function RapportPhoto() {
  const [constatations, setConstatations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Formulaire
  const [formData, setFormData] = useState({
    city: '',
    building: '',
    task: '',
    company: '',
    selectedDate: new Date().toISOString().split('T')[0]
  });
  
  // Images
  const [imageAvant, setImageAvant] = useState(null);
  const [imageApres, setImageApres] = useState(null);
  const [previewAvant, setPreviewAvant] = useState('');
  const [previewApres, setPreviewApres] = useState('');
  
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user && !loading) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (token) {
      fetchConstatations();
    }
  }, [token]);

  const fetchConstatations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/constatations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConstatations(response.data.constatations || []);
    } catch (error) {
      console.error('Erreur lors du chargement des constatations:', error);
      setError('Impossible de charger les constatations');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (type, event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (type === 'avant') {
          setImageAvant(file);
          setPreviewAvant(e.target.result);
        } else {
          setImageApres(file);
          setPreviewApres(e.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const convertImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      // Vérifier la taille du fichier (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('L\'image est trop volumineuse (max 5MB)'));
        return;
      }
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new window.Image();
      
      img.onload = () => {
        // Redimensionner l'image si elle est trop grande
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 600;
        
        let { width, height } = img;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height = (height * MAX_WIDTH) / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = (width * MAX_HEIGHT) / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convertir en base64 avec compression
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        resolve(base64);
      };
      
      img.onerror = () => reject(new Error('Erreur lors du chargement de l\'image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!imageAvant || !imageApres) {
      setError('Veuillez sélectionner les deux images (avant et après)');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      console.log('Début de la conversion des images...');
      
      // Conversion des images en base64 avec gestion d'erreur
      const imageAvantBase64 = await convertImageToBase64(imageAvant);
      console.log('Image avant convertie, taille:', imageAvantBase64.length);
      
      const imageApresBase64 = await convertImageToBase64(imageApres);
      console.log('Image après convertie, taille:', imageApresBase64.length);
      
      const constatationData = {
        ...formData,
        imageAvant: imageAvantBase64,
        imageApres: imageApresBase64
      };

      console.log('Envoi des données au backend...');
      const response = await axios.post(`${API_BASE_URL}/constatations`, constatationData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Réponse du backend:', response.data);
      setSuccess('Rapport photo créé avec succès !');
      setShowModal(false);
      resetForm();
      fetchConstatations();
    } catch (error) {
      console.error('Erreur complète:', error);
      console.error('Message d\'erreur:', error.message);
      
      if (error.response) {
        console.error('Réponse du serveur:', error.response.data);
        setError(`Erreur serveur: ${error.response.data.message || error.response.status}`);
      } else if (error.request) {
        console.error('Pas de réponse du serveur');
        setError('Pas de réponse du serveur. Vérifiez votre connexion.');
      } else {
        setError(`Erreur: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      city: '',
      building: '',
      task: '',
      company: '',
      selectedDate: new Date().toISOString().split('T')[0]
    });
    setImageAvant(null);
    setImageApres(null);
    setPreviewAvant('');
    setPreviewApres('');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const exportToPDF = async () => {
    try {
      const pdf = new jsPDF();
    let yPosition = 20;
    
    // Titre du rapport
    pdf.setFontSize(20);
    pdf.text('Rapport Photo - Constatations', 20, yPosition);
    yPosition += 20;
    
    // Date du rapport
    pdf.setFontSize(12);
    pdf.text(`Date du rapport: ${new Date().toLocaleDateString('fr-FR')}`, 20, yPosition);
    yPosition += 15;
    
    // Utilisateur
    pdf.text(`Utilisateur: ${user.name || user.email}`, 20, yPosition);
    yPosition += 20;

    for (let i = 0; i < constatations.length; i++) {
      const constatation = constatations[i];
      
      // Nouvelle page si nécessaire
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }
      
      // Informations de la constatation
      pdf.setFontSize(14);
      pdf.text(`Constatation ${i + 1}`, 20, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(10);
      pdf.text(`Ville: ${constatation.city}`, 20, yPosition);
      yPosition += 5;
      pdf.text(`Bâtiment: ${constatation.building}`, 20, yPosition);
      yPosition += 5;
      pdf.text(`Tâche: ${constatation.task}`, 20, yPosition);
      yPosition += 5;
      pdf.text(`Entreprise: ${constatation.company}`, 20, yPosition);
      yPosition += 5;
      pdf.text(`Date: ${new Date(constatation.selectedDate).toLocaleDateString('fr-FR')}`, 20, yPosition);
      yPosition += 15;

      // Images (si disponibles)
      if (constatation.imageAvant && constatation.imageApres) {
        try {
          // Image Avant
          pdf.text('AVANT:', 20, yPosition);
          pdf.addImage(constatation.imageAvant, 'JPEG', 20, yPosition + 5, 70, 50);
          
          // Flèche
          pdf.text('→', 100, yPosition + 25);
          
          // Image Après
          pdf.text('APRÈS:', 110, yPosition);
          pdf.addImage(constatation.imageApres, 'JPEG', 110, yPosition + 5, 70, 50);
          
          yPosition += 70;
        } catch (error) {
          console.warn('Erreur lors de l\'ajout des images:', error);
          pdf.text('Images non disponibles', 20, yPosition);
          yPosition += 10;
        }
      }
      
      yPosition += 10; // Espace entre les constatations
    }
    
      // Télécharger le PDF
      const fileName = `rapport-photo-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      setSuccess('PDF exporté avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      setError(`Erreur lors de l'export PDF: ${error.message}`);
    }
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
          <Navbar.Brand style={{ fontWeight: '600', fontSize: '1.5rem' }}>
            📷 Rapport Photo
          </Navbar.Brand>
          
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link onClick={() => navigate('/dashboard')}>Accueil</Nav.Link>
              <Nav.Link active>Rapport Photo</Nav.Link>
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
                  <Dropdown.Item onClick={() => navigate('/dashboard')}>
                    Dashboard
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
      <Container fluid style={{ marginTop: '80px', padding: '20px' }}>
        {/* Header de la page */}
        <Row className="mb-4">
          <Col>
            <div style={{
              background: 'linear-gradient(135deg, #F85F6A 0%, #e74c3c 100%)',
              borderRadius: '12px',
              padding: '30px',
              color: 'white',
              textAlign: 'center'
            }}>
              <h2 style={{ fontWeight: '700', marginBottom: '10px' }}>
                📷 Rapport Photo - Avant/Après
              </h2>
              <p style={{ opacity: '0.9' }}>
                Créez des rapports avec photos avant/après et exportez en PDF
              </p>
            </div>
          </Col>
        </Row>

        {/* Messages d'alerte */}
        {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
        {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible>{success}</Alert>}

        {/* Boutons d'action */}
        <Row className="mb-4">
          <Col>
            <div className="d-flex gap-3">
              <Button
                style={{
                  background: 'linear-gradient(135deg, #F85F6A 0%, #e74c3c 100%)',
                  border: 'none',
                  fontWeight: '600'
                }}
                onClick={() => setShowModal(true)}
              >
                ➕ Nouveau Rapport Photo
              </Button>
              
              {constatations.length > 0 && (
                <Button
                  variant="outline-primary"
                  onClick={exportToPDF}
                  style={{ fontWeight: '600' }}
                >
                  📄 Exporter en PDF
                </Button>
              )}
            </div>
          </Col>
        </Row>

        {/* Liste des constatations */}
        <Row>
          <Col>
            {loading ? (
              <div className="text-center">
                <Spinner animation="border" style={{ color: '#F85F6A' }} />
                <p className="mt-3">Chargement des rapports...</p>
              </div>
            ) : constatations.length === 0 ? (
              <Card className="text-center">
                <Card.Body>
                  <h5>Aucun rapport photo créé</h5>
                  <p className="text-muted">Cliquez sur "Nouveau Rapport Photo" pour commencer</p>
                </Card.Body>
              </Card>
            ) : (
              <Row>
                {constatations.map((constatation, index) => (
                  <Col key={constatation._id} xs={12} md={6} lg={4} className="mb-4">
                    <Card className="h-100">
                      <Card.Header 
                        style={{ 
                          background: 'linear-gradient(135deg, #F85F6A 0%, #e74c3c 100%)',
                          color: 'white',
                          fontWeight: '600'
                        }}
                      >
                        📋 Constatation {index + 1}
                      </Card.Header>
                      <Card.Body>
                        <div className="mb-3">
                          <strong>Ville :</strong> {constatation.city}<br/>
                          <strong>Bâtiment :</strong> {constatation.building}<br/>
                          <strong>Tâche :</strong> {constatation.task}<br/>
                          <strong>Entreprise :</strong> {constatation.company}<br/>
                          <strong>Date :</strong> {new Date(constatation.selectedDate).toLocaleDateString('fr-FR')}
                        </div>
                        
                        {/* Images avant/après */}
                        {constatation.imageAvant && constatation.imageApres && (
                          <div className="mb-3">
                            <div className="d-flex justify-content-between align-items-center">
                              <div className="text-center" style={{ width: '45%' }}>
                                <small className="text-muted d-block mb-1">AVANT</small>
                                <Image 
                                  src={constatation.imageAvant} 
                                  alt="Avant"
                                  style={{ 
                                    width: '100%', 
                                    height: '80px', 
                                    objectFit: 'cover',
                                    borderRadius: '8px',
                                    border: '2px solid #ddd'
                                  }}
                                />
                              </div>
                              <div style={{ fontSize: '24px', color: '#F85F6A' }}>→</div>
                              <div className="text-center" style={{ width: '45%' }}>
                                <small className="text-muted d-block mb-1">APRÈS</small>
                                <Image 
                                  src={constatation.imageApres} 
                                  alt="Après"
                                  style={{ 
                                    width: '100%', 
                                    height: '80px', 
                                    objectFit: 'cover',
                                    borderRadius: '8px',
                                    border: '2px solid #ddd'
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Col>
        </Row>

        {/* Modal pour nouveau rapport */}
        <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>📷 Nouveau Rapport Photo</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form onSubmit={handleSubmit}>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Ville</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Bâtiment</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.building}
                      onChange={(e) => setFormData({...formData, building: e.target.value})}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Tâche</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.task}
                      onChange={(e) => setFormData({...formData, task: e.target.value})}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Entreprise</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({...formData, company: e.target.value})}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Date</Form.Label>
                <Form.Control
                  type="date"
                  value={formData.selectedDate}
                  onChange={(e) => setFormData({...formData, selectedDate: e.target.value})}
                  required
                />
              </Form.Group>

              {/* Upload d'images */}
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Photo AVANT</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageChange('avant', e)}
                      required
                    />
                    {previewAvant && (
                      <div className="mt-2 text-center">
                        <Image 
                          src={previewAvant} 
                          alt="Prévisualisation avant"
                          style={{ 
                            maxWidth: '100%', 
                            height: '150px', 
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '2px solid #ddd'
                          }}
                        />
                      </div>
                    )}
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Photo APRÈS</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageChange('apres', e)}
                      required
                    />
                    {previewApres && (
                      <div className="mt-2 text-center">
                        <Image 
                          src={previewApres} 
                          alt="Prévisualisation après"
                          style={{ 
                            maxWidth: '100%', 
                            height: '150px', 
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '2px solid #ddd'
                          }}
                        />
                      </div>
                    )}
                  </Form.Group>
                </Col>
              </Row>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Annuler
            </Button>
            <Button
              style={{
                background: 'linear-gradient(135deg, #F85F6A 0%, #e74c3c 100%)',
                border: 'none'
              }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <Spinner size="sm" /> : '💾 Sauvegarder'}
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </>
  );
}