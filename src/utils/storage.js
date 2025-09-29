// Utilitaire pour gérer le stockage (localStorage pour le web)
class Storage {
  static getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Erreur lors de la récupération depuis le storage:', error);
      return null;
    }
  }

  static setItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde dans le storage:', error);
      return false;
    }
  }

  static removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Erreur lors de la suppression du storage:', error);
      return false;
    }
  }

  static clear() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Erreur lors du nettoyage du storage:', error);
      return false;
    }
  }
}

export default Storage;