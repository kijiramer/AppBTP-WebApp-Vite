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

  // Numéro de rapport actuel (dossier)
  const [currentReportNumber, setCurrentReportNumber] = useState(1);

  // Informations générales du rapport
  const [rapportInfo, setRapportInfo] = useState({
    chantierName: '',
    city: '',
    building: '',
    task: '',
    company: '',
    selectedDate: new Date().toISOString().split('T')[0],
    endDate: ''
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
      const allConstatations = response.data.constatations || [];
      setConstatations(allConstatations);

      // Calculer le prochain numéro de rapport disponible
      if (allConstatations.length > 0) {
        const maxReportNumber = Math.max(...allConstatations.map(c => c.reportNumber || 0));
        setCurrentReportNumber(maxReportNumber + 1);
      }
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

    if (!rapportInfo.chantierName || !rapportInfo.city || !rapportInfo.building || !rapportInfo.task || !rapportInfo.company) {
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
          reportNumber: currentReportNumber,
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

      setSuccess(`Dossier ${currentReportNumber} créé avec succès ! (${photos.length} paire(s) de photos)`);
      // Incrémenter le numéro pour le prochain rapport
      setCurrentReportNumber(currentReportNumber + 1);
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
      chantierName: '',
      city: '',
      building: '',
      task: '',
      company: '',
      selectedDate: new Date().toISOString().split('T')[0],
      endDate: ''
    });
    setPhotos([]);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleDelete = async (constatationId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce rapport photo d\'intervention ?')) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`${API_BASE_URL}/constatations/${constatationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Rapport supprimé avec succès !');
      fetchConstatations();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      setError('Impossible de supprimer le rapport');
    } finally {
      setLoading(false);
    }
  };

  const loadLogoAsBase64 = () => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/jpeg');
        resolve(dataURL);
      };
      img.onerror = () => reject(new Error('Erreur lors du chargement du logo'));
      img.src = '/logo.jpg';
    });
  };

  const exportToPDF = async () => {
    // Demander quel dossier exporter
    const availableFolders = [...new Set(constatations.map(c => c.reportNumber))].sort((a, b) => a - b);

    if (availableFolders.length === 0) {
      setError('Aucun dossier à exporter');
      return;
    }

    const folderChoice = prompt(`Quel dossier voulez-vous exporter ?\nDossiers disponibles : ${availableFolders.join(', ')}\n\nEntrez le numéro du dossier :`);

    if (!folderChoice) {
      return; // L'utilisateur a annulé
    }

    const selectedFolder = parseInt(folderChoice);
    if (!availableFolders.includes(selectedFolder)) {
      setError(`Le dossier ${selectedFolder} n'existe pas`);
      return;
    }

    try {
      // Charger le logo en base64
      let logoDataURL = null;
      try {
        logoDataURL = await loadLogoAsBase64();
      } catch (error) {
        console.warn('Logo non chargé:', error);
      }

      const pdf = new jsPDF();
      let yPosition = 10; // Position de départ pour le logo

      // Filtrer les constatations pour le dossier sélectionné
      const folderConstatations = constatations.filter(c => c.reportNumber === selectedFolder);

      // Obtenir le nom du chantier
      const chantierName = folderConstatations.length > 0 ? folderConstatations[0].chantierName : `Dossier ${selectedFolder}`;

      // Grouper les constatations par chantier (city, building, task, company, date, endDate)
      const groupedConstatations = {};
      folderConstatations.forEach((constatation) => {
        const key = `${constatation.city}|${constatation.building}|${constatation.task}|${constatation.company}|${constatation.selectedDate}|${constatation.endDate || ''}`;
        if (!groupedConstatations[key]) {
          groupedConstatations[key] = {
            info: {
              chantierName: constatation.chantierName,
              city: constatation.city,
              building: constatation.building,
              task: constatation.task,
              company: constatation.company,
              selectedDate: constatation.selectedDate,
              endDate: constatation.endDate
            },
            photos: []
          };
        }
        groupedConstatations[key].photos.push(constatation);
      });

      // Ajouter le logo centré en haut de la première page
      if (logoDataURL) {
        try {
          const logoWidth = 60;
          const logoHeight = 30;
          const logoX = (pdf.internal.pageSize.width - logoWidth) / 2;
          pdf.addImage(logoDataURL, 'JPEG', logoX, yPosition, logoWidth, logoHeight);
          yPosition += logoHeight + 10; // Espace après le logo
        } catch (error) {
          console.warn('Erreur lors de l\'ajout du logo:', error);
        }
      }

      // Titre du rapport (une seule fois au début) - Centré et souligné avec police Times (style Bodoni)
      pdf.setFontSize(20);
      pdf.setFont('times', 'bold');
      const titleText = `Rapport Photo d'Intervention - ${chantierName}`;
      const titleWidth = pdf.getTextWidth(titleText);
      const centerX = (pdf.internal.pageSize.width - titleWidth) / 2;

      // Texte centré
      pdf.setTextColor(0, 0, 0);
      pdf.text(titleText, centerX, yPosition);

      // Ligne de soulignement
      pdf.setLineWidth(0.5);
      pdf.setDrawColor(0, 0, 0);
      pdf.line(centerX, yPosition + 2, centerX + titleWidth, yPosition + 2);

      yPosition += 15;

      // Variables de comptage des photos par page (global pour tout le PDF)
      let currentPageNumber = 1;
      let photosOnCurrentPage = 0;
      const maxPhotosFirstPage = 3;
      const maxPhotosOtherPages = 4;

      // Pour chaque groupe de constatations
      let groupIndex = 0;
      for (const key in groupedConstatations) {
        const group = groupedConstatations[key];

        // Vérifier si on a besoin d'une nouvelle page pour afficher les infos du groupe
        if (yPosition > 240) {
          pdf.addPage();
          currentPageNumber++;
          yPosition = 30; // Espace pour le logo pages 2+ (10 + 15 + 5)
          photosOnCurrentPage = 0;
        }

        // Afficher les informations du chantier pour ce groupe
        if (groupIndex > 0) {
          // Espacement entre les groupes
          yPosition += 10;
        }

        // Créer un tableau centré avec 3 lignes et 1 colonne
        const tableWidth = 160;
        const tableX = (pdf.internal.pageSize.width - tableWidth) / 2;
        const rowHeight = 10;
        const radius = 3;

        // Dessiner le tableau avec coins arrondis
        pdf.setLineWidth(0.5);
        pdf.setDrawColor(0, 0, 0);

        // Utiliser roundedRect si disponible, sinon rectangle normal
        if (typeof pdf.roundedRect === 'function') {
          pdf.roundedRect(tableX, yPosition, tableWidth, rowHeight * 3, radius, radius);
        } else {
          pdf.rect(tableX, yPosition, tableWidth, rowHeight * 3);
        }

        // Lignes horizontales entre les lignes
        pdf.line(tableX, yPosition + rowHeight, tableX + tableWidth, yPosition + rowHeight);
        pdf.line(tableX, yPosition + rowHeight * 2, tableX + tableWidth, yPosition + rowHeight * 2);

        // Utiliser une police stylée (Helvetica)
        pdf.setFont('helvetica');

        // Ligne 1 : PROMOTEUR et VILLE (en gras et majuscules)
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        const promoteurText = `PROMOTEUR: ${group.info.company.toUpperCase()} - VILLE: ${group.info.city.toUpperCase()}`;
        pdf.text(promoteurText, tableX + 2, yPosition + 7);

        // Ligne 2 : Mission (en regular)
        pdf.setFont('helvetica', 'normal');
        const missionText = `Mission: ${group.info.task}`;
        pdf.text(missionText, tableX + 2, yPosition + rowHeight + 7);

        // Ligne 3 : Intervention (en regular)
        pdf.setFont('helvetica', 'normal');
        const startDate = new Date(group.info.selectedDate).toLocaleDateString('fr-FR');
        let interventionText;
        if (group.info.endDate) {
          const endDateFormatted = new Date(group.info.endDate).toLocaleDateString('fr-FR');
          interventionText = `Intervention du ${startDate} au ${endDateFormatted}`;
        } else {
          interventionText = `Intervention le: ${startDate}`;
        }
        pdf.text(interventionText, tableX + 2, yPosition + rowHeight * 2 + 7);

        yPosition += rowHeight * 3 + 10;

        // Liste des photos pour ce chantier

        for (let i = 0; i < group.photos.length; i++) {
          const constatation = group.photos[i];

          // Déterminer le nombre maximum de photos pour la page actuelle
          const maxPhotosOnPage = currentPageNumber === 1 ? maxPhotosFirstPage : maxPhotosOtherPages;

          // Vérifier si on a besoin d'une nouvelle page
          if (photosOnCurrentPage >= maxPhotosOnPage) {
            pdf.addPage();
            currentPageNumber++;
            yPosition = 30; // Espace pour le logo pages 2+ (10 + 15 + 5)
            photosOnCurrentPage = 0;
          }

          // Images avant/après
          if (constatation.imageAvant && constatation.imageApres) {
            try {
              // Label et Image AVANT
              pdf.setFontSize(10);
              pdf.setFont('helvetica', 'bold');
              pdf.text('AVANT', 45, yPosition - 2);
              pdf.addImage(constatation.imageAvant, 'JPEG', 20, yPosition, 70, 50);

              // Flèche horizontale entre les deux images (ligne + triangle)
              const arrowY = yPosition + 25;
              const arrowStartX = 92;
              const arrowEndX = 108;

              // Ligne horizontale
              pdf.setLineWidth(1.5);
              pdf.setDrawColor(0, 0, 0);
              pdf.line(arrowStartX, arrowY, arrowEndX - 3, arrowY);

              // Triangle (pointe de la flèche) - dessiné avec polygon
              pdf.setFillColor(0, 0, 0);
              const trianglePoints = [
                { x: arrowEndX, y: arrowY },
                { x: arrowEndX - 3, y: arrowY - 2 },
                { x: arrowEndX - 3, y: arrowY + 2 }
              ];
              pdf.lines(
                [
                  [trianglePoints[1].x - trianglePoints[0].x, trianglePoints[1].y - trianglePoints[0].y],
                  [trianglePoints[2].x - trianglePoints[1].x, trianglePoints[2].y - trianglePoints[1].y],
                  [trianglePoints[0].x - trianglePoints[2].x, trianglePoints[0].y - trianglePoints[2].y]
                ],
                trianglePoints[0].x,
                trianglePoints[0].y,
                [1, 1],
                'F'
              );

              // Label et Image APRÈS
              pdf.setFontSize(10);
              pdf.setFont('helvetica', 'bold');
              pdf.text('APRÈS', 135, yPosition - 2);
              pdf.addImage(constatation.imageApres, 'JPEG', 110, yPosition, 70, 50);

              yPosition += 55;
              photosOnCurrentPage++;
            } catch (error) {
              console.warn('Erreur lors de l\'ajout des images:', error);
              pdf.setFont(undefined, 'normal');
              pdf.setFontSize(10);
              pdf.text('Images non disponibles', 20, yPosition);
              yPosition += 10;
            }
          }

          // Espacement entre les paires de photos
          yPosition += 10;
        }

        groupIndex++;
      }

      // Ajouter la numérotation des pages et le logo sur chaque page
      const totalPages = pdf.internal.getNumberOfPages();

      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);

        // Ajouter le logo en haut à gauche des pages 2+ (deux fois moins grand)
        // (La page 1 a déjà le logo centré ajouté en haut du document)
        if (logoDataURL && i > 1) {
          try {
            const logoWidth = 30;
            const logoHeight = 15;
            pdf.addImage(logoDataURL, 'JPEG', 10, 10, logoWidth, logoHeight);
          } catch (error) {
            console.warn('Erreur lors de l\'ajout du logo:', error);
          }
        }

        // Ajouter la numérotation en bas de page
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        const pageText = `Page ${i} / ${totalPages}`;
        const textWidth = pdf.getTextWidth(pageText);
        const pageWidth = pdf.internal.pageSize.width;
        pdf.text(pageText, (pageWidth - textWidth) / 2, pdf.internal.pageSize.height - 10);
      }

      const fileName = `rapport-intervention-dossier-${selectedFolder}-${new Date().toISOString().split('T')[0]}.pdf`;
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
            📷 Rapport Photo d'Intervention
          </Navbar.Brand>

          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link onClick={() => navigate('/dashboard')}>Accueil</Nav.Link>
              <Nav.Link active>Rapport Photo d'Intervention</Nav.Link>
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
                📷 Dossier {currentReportNumber}
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
                <Col md={12}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nom du chantier</Form.Label>
                    <Form.Control
                      type="text"
                      value={rapportInfo.chantierName}
                      onChange={(e) => setRapportInfo({...rapportInfo, chantierName: e.target.value})}
                      placeholder="Ex: Résidence Les Jardins"
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

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
                    <Form.Label>Mission</Form.Label>
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
                    <Form.Label>Promoteur</Form.Label>
                    <Form.Control
                      type="text"
                      value={rapportInfo.company}
                      onChange={(e) => setRapportInfo({...rapportInfo, company: e.target.value})}
                      placeholder="Ex: HOPRA"
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Date de début</Form.Label>
                    <Form.Control
                      type="date"
                      value={rapportInfo.selectedDate}
                      onChange={(e) => setRapportInfo({...rapportInfo, selectedDate: e.target.value})}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Date de fin (optionnelle)</Form.Label>
                    <Form.Control
                      type="date"
                      value={rapportInfo.endDate}
                      onChange={(e) => setRapportInfo({...rapportInfo, endDate: e.target.value})}
                    />
                  </Form.Group>
                </Col>
              </Row>
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
              <h3>📚 Rapports d'intervention enregistrés</h3>
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
                  <h5>Aucun rapport photo d'intervention enregistré</h5>
                  <p className="text-muted">Créez votre premier rapport ci-dessus</p>
                </Card.Body>
              </Card>
            ) : (
              <>
                {(() => {
                  // Grouper les constatations par reportNumber
                  const groupedReports = {};
                  constatations.forEach(c => {
                    if (!groupedReports[c.reportNumber]) {
                      groupedReports[c.reportNumber] = [];
                    }
                    groupedReports[c.reportNumber].push(c);
                  });

                  // Afficher chaque dossier
                  return Object.keys(groupedReports).sort((a, b) => Number(b) - Number(a)).map(reportNum => {
                    const reportPhotos = groupedReports[reportNum];
                    const firstPhoto = reportPhotos[0];

                    return (
                      <Card key={reportNum} className="mb-4">
                        <Card.Header
                          style={{
                            background: 'linear-gradient(135deg, #F85F6A 0%, #e74c3c 100%)',
                            color: 'white',
                            fontWeight: '600',
                            fontSize: '1.2rem'
                          }}
                        >
                          📁 Dossier {reportNum}
                        </Card.Header>
                        <Card.Body>
                          {/* Informations du dossier */}
                          <div className="mb-3">
                            <strong>Ville :</strong> {firstPhoto.city}<br/>
                            <strong>Bâtiment :</strong> {firstPhoto.building}<br/>
                            <strong>Mission :</strong> {firstPhoto.task}<br/>
                            <strong>Promoteur :</strong> {firstPhoto.company}<br/>
                            <strong>Date :</strong> {new Date(firstPhoto.selectedDate).toLocaleDateString('fr-FR')}<br/>
                            <strong>Nombre de photos :</strong> {reportPhotos.length} paire(s)
                          </div>

                          {/* Photos du dossier */}
                          <Row>
                            {reportPhotos.map((constatation, photoIndex) => (
                              <Col key={constatation._id} xs={12} md={6} lg={4} className="mb-3">
                                <Card>
                                  <Card.Header className="text-center" style={{ background: '#f8f9fa', fontWeight: '600' }}>
                                    Photo {photoIndex + 1}
                                  </Card.Header>
                                  <Card.Body>
                                    {constatation.imageAvant && constatation.imageApres && (
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
                                    )}
                                    <div className="d-grid mt-2">
                                      <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => handleDelete(constatation._id)}
                                        disabled={loading}
                                      >
                                        🗑️ Supprimer
                                      </Button>
                                    </div>
                                  </Card.Body>
                                </Card>
                              </Col>
                            ))}
                          </Row>
                        </Card.Body>
                      </Card>
                    );
                  });
                })()}
              </>
            )}
          </Col>
        </Row>
      </Container>
    </>
  );
}