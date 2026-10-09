import SearchableProductPicker from './SearchableProductPicker.jsx';
import { useProductFavorites } from '../hooks/useProductFavorites.js';
export default function ProductSelector(props) {
  const favorites = useProductFavorites();
  return <SearchableProductPicker {...props} {...favorites} />;
}
