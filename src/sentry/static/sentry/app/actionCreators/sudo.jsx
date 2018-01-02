import SudoActions from '../actions/sudoActions';

/**
 * Show "sudo" modal
 */
export function openSudo(options = {}) {
  SudoActions.openModal(options);
}
