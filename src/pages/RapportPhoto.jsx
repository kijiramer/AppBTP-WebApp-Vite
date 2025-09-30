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

export default function RapportPhoto() {
  const [constatations, setConstatations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Informations générales du rapport
  const [rapportInfo, setRapportInfo] = useState({
    city: '',
    building: '',
    task: '',
    company: '',
    selectedDate: new Date().toISOString().split('T')[0]
  });

  // Liste des paires de photos
  const [photos, setPhotos] = useState([]);

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

  const handleImageChange = (index, type, event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newPhotos = [...photos];
        newPhotos[index][type] = file;
        newPhotos[index][`preview${type === 'imageAvant' ? 'Avant' : 'Apres'}`] = e.target.result;
        setPhotos(newPhotos);
      };
      reader.readAsDataURL(file);
    }
  };

  const convertImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('L\'image est trop volumineuse (max 5MB)'));
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new window.Image();

      img.onload = () => {
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

        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        resolve(base64);
      };

      img.onerror = () => reject(new Error('Erreur lors du chargement de l\'image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const addPhotoRow = () => {
    setPhotos([...photos, {
      imageAvant: null,
      imageApres: null,
      previewAvant: '',
      previewApres: ''
    }]);
  };

  const removePhotoRow = (index) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!rapportInfo.city || !rapportInfo.building || !rapportInfo.task || !rapportInfo.company) {
      setError('Veuillez remplir toutes les informations du rapport');
      return;
    }

    if (photos.length === 0) {
      setError('Veuillez ajouter au moins une paire de photos');
      return;
    }

    for (let i = 0; i < photos.length; i++) {
      if (!photos[i].imageAvant || !photos[i].imageApres) {
        setError(`Veuillez sélectionner les deux images (avant et après) pour la paire ${i + 1}`);
        return;
      }
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      console.log('Début de la conversion des images...');

      // Créer une constatation pour chaque paire de photos
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];

        const imageAvantBase64 = await convertImageToBase64(photo.imageAvant);
        const imageApresBase64 = await convertImageToBase64(photo.imageApres);

        const constatationData = {
          ...rapportInfo,
          imageAvant: imageAvantBase64,
          imageApres: imageApresBase64
        };

        console.log(`Envoi de la paire ${i + 1}/${photos.length} au backend...`);

        if (!token) {
          throw new Error('Token manquant - veuillez vous reconnecter');
        }

        await axios.post(`${API_BASE_URL}/constatations`, constatationData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }

      setSuccess(`Rapport photo créé avec succès ! (${photos.length} paire(s) de photos)`);
      resetForm();
      fetchConstatations();
    } catch (error) {
      console.error('Erreur complète:', error);

      if (error.response) {
        console.error('Réponse du serveur:', JSON.stringify(error.response.data, null, 2));
        setError(`Erreur serveur: ${error.response.data?.message || error.response.data?.error || error.response.status}`);
      } else if (error.request) {
        setError('Pas de réponse du serveur. Vérifiez votre connexion.');
      } else {
        setError(`Erreur: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setRapportInfo({
      city: '',
      building: '',
      task: '',
      company: '',
      selectedDate: new Date().toISOString().split('T')[0]
    });
    setPhotos([]);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const exportToPDF = async () => {
    try {
      const pdf = new jsPDF();
      let yPosition = 20;

      // Grouper les constatations par chantier (city, building, task, company, date)
      const groupedConstatations = {};
      constatations.forEach((constatation) => {
        const key = `${constatation.city}|${constatation.building}|${constatation.task}|${constatation.company}|${constatation.selectedDate}`;
        if (!groupedConstatations[key]) {
          groupedConstatations[key] = {
            info: {
              city: constatation.city,
              building: constatation.building,
              task: constatation.task,
              company: constatation.company,
              selectedDate: constatation.selectedDate
            },
            photos: []
          };
        }
        groupedConstatations[key].photos.push(constatation);
      });

      // Pour chaque groupe de constatations
      let groupIndex = 0;
      for (const key in groupedConstatations) {
        const group = groupedConstatations[key];

        // Ajouter une nouvelle page si ce n'est pas le premier groupe
        if (groupIndex > 0) {
          pdf.addPage();
          yPosition = 20;
        }

        // Titre du rapport
        pdf.setFontSize(20);
        pdf.text('Rapport Photo - Constatations', 20, yPosition);
        yPosition += 15;

        // Informations du chantier (affichées UNE SEULE FOIS)
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text(`Entreprise : ${group.info.company} - Ville : ${group.info.city} - Tâche : ${group.info.task}`, 20, yPosition);
        yPosition += 8;
        pdf.text(`Intervention le : ${new Date(group.info.selectedDate).toLocaleDateString('fr-FR')}`, 20, yPosition);
        yPosition += 15;

        // Separator line
        pdf.setLineWidth(0.5);
        pdf.line(20, yPosition, 190, yPosition);
        yPosition += 10;

        // Liste des photos pour ce chantier
        for (let i = 0; i < group.photos.length; i++) {
          const constatation = group.photos[i];

          // Vérifier si on a besoin d'une nouvelle page
          if (yPosition > 220) {
            pdf.addPage();
            yPosition = 20;
          }

          // Images avant/après
          if (constatation.imageAvant && constatation.imageApres) {
            try {
              // Image AVANT
              pdf.addImage(constatation.imageAvant, 'JPEG', 20, yPosition, 70, 50);

              // Flèche entre les deux images
              pdf.setFontSize(16);
              pdf.setFont(undefined, 'bold');
              pdf.text('→', 100, yPosition + 25);

              // Image APRÈS
              pdf.addImage(constatation.imageApres, 'JPEG', 110, yPosition, 70, 50);

              yPosition += 55;
            } catch (error) {
              console.warn('Erreur lors de l\'ajout des images:', error);
              pdf.setFont(undefined, 'normal');
              pdf.setFontSize(10);
              pdf.text('Images non disponibles', 20, yPosition);
              yPosition += 10;
            }
          }

          // Ajouter une flèche entre les paires de photos (sauf après la dernière)
          if (i < group.photos.length - 1) {
            pdf.setFontSize(20);
            pdf.setFont(undefined, 'bold');
            const arrowText = '↓';
            const textWidth = pdf.getTextWidth(arrowText);
            const centerX = (pdf.internal.pageSize.width - textWidth) / 2;
            pdf.text(arrowText, centerX, yPosition + 5);
            yPosition += 15;
          } else {
            yPosition += 10;
          }
        }

        groupIndex++;
      }

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
                📷 Nouveau Rapport Photo
              </h2>
              <p style={{ opacity: '0.9' }}>
                Saisissez les informations du chantier, puis ajoutez plusieurs photos avant/après
              </p>
            </div>
          </Col>
        </Row>

        {/* Messages d'alerte */}
        {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
        {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible>{success}</Alert>}

        {/* Formulaire d'informations générales */}
        <Card className="mb-4">
          <Card.Header style={{ background: 'linear-gradient(135deg, #F85F6A 0%, #e74c3c 100%)', color: 'white', fontWeight: '600' }}>
            📋 Informations du chantier
          </Card.Header>
          <Card.Body>
            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Ville</Form.Label>
                    <Form.Control
                      type="text"
                      value={rapportInfo.city}
                      onChange={(e) => setRapportInfo({...rapportInfo, city: e.target.value})}
                      placeholder="Ex: Paris"
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Bâtiment</Form.Label>
                    <Form.Control
                      type="text"
                      value={rapportInfo.building}
                      onChange={(e) => setRapportInfo({...rapportInfo, building: e.target.value})}
                      placeholder="Ex: Bâtiment A"
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
                      value={rapportInfo.task}
                      onChange={(e) => setRapportInfo({...rapportInfo, task: e.target.value})}
                      placeholder="Ex: Peinture"
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Entreprise</Form.Label>
                    <Form.Control
                      type="text"
                      value={rapportInfo.company}
                      onChange={(e) => setRapportInfo({...rapportInfo, company: e.target.value})}
                      placeholder="Ex: BTP Pro"
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Date</Form.Label>
                <Form.Control
                  type="date"
                  value={rapportInfo.selectedDate}
                  onChange={(e) => setRapportInfo({...rapportInfo, selectedDate: e.target.value})}
                  required
                />
              </Form.Group>
            </Form>
          </Card.Body>
        </Card>

        {/* Section Photos */}
        <Card className="mb-4">
          <Card.Header style={{ background: 'linear-gradient(135deg, #F85F6A 0%, #e74c3c 100%)', color: 'white', fontWeight: '600' }}>
            📸 Photos Avant / Après
          </Card.Header>
          <Card.Body>
            {photos.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted">Aucune photo ajoutée</p>
                <Button
                  onClick={addPhotoRow}
                  style={{
                    background: 'linear-gradient(135deg, #F85F6A 0%, #e74c3c 100%)',
                    border: 'none'
                  }}
                >
                  ➕ Ajouter une paire de photos
                </Button>
              </div>
            ) : (
              <>
                {photos.map((photo, index) => (
                  <Card key={index} className="mb-3" style={{ border: '2px solid #F85F6A' }}>
                    <Card.Header style={{ background: '#fff3f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>Paire de photos #{index + 1}</strong>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removePhotoRow(index)}
                      >
                        ✕ Supprimer
                      </Button>
                    </Card.Header>
                    <Card.Body>
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Photo AVANT</Form.Label>
                            <Form.Control
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageChange(index, 'imageAvant', e)}
                            />
                            {photo.previewAvant && (
                              <div className="mt-2 text-center">
                                <Image
                                  src={photo.previewAvant}
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
                              onChange={(e) => handleImageChange(index, 'imageApres', e)}
                            />
                            {photo.previewApres && (
                              <div className="mt-2 text-center">
                                <Image
                                  src={photo.previewApres}
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
                    </Card.Body>
                  </Card>
                ))}

                <div className="text-center mt-3">
                  <Button
                    onClick={addPhotoRow}
                    variant="outline-primary"
                    style={{ marginRight: '10px' }}
                  >
                    ➕ Ajouter une autre paire de photos
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                      background: 'linear-gradient(135deg, #F85F6A 0%, #e74c3c 100%)',
                      border: 'none'
                    }}
                  >
                    {loading ? <Spinner size="sm" /> : '💾 Sauvegarder le rapport'}
                  </Button>
                </div>
              </>
            )}
          </Card.Body>
        </Card>

        {/* Liste des rapports existants */}
        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3>📚 Rapports enregistrés</h3>
              {constatations.length > 0 && (
                <Button
                  variant="outline-primary"
                  onClick={exportToPDF}
                >
                  📄 Exporter en PDF
                </Button>
              )}
            </div>
          </Col>
        </Row>

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
                  <h5>Aucun rapport photo enregistré</h5>
                  <p className="text-muted">Créez votre premier rapport ci-dessus</p>
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
                        📋 Rapport {index + 1}
                      </Card.Header>
                      <Card.Body>
                        <div className="mb-3">
                          <strong>Ville :</strong> {constatation.city}<br/>
                          <strong>Bâtiment :</strong> {constatation.building}<br/>
                          <strong>Tâche :</strong> {constatation.task}<br/>
                          <strong>Entreprise :</strong> {constatation.company}<br/>
                          <strong>Date :</strong> {new Date(constatation.selectedDate).toLocaleDateString('fr-FR')}
                        </div>

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
      </Container>
    </>
  );
}