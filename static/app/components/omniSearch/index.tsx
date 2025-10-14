import {openModal} from 'sentry/actionCreators/modal';

import OmniSearchModal, {modalCss} from './ui/modal';

export function openOmniSearch() {
  openModal(deps => <OmniSearchModal {...deps} />, {modalCss});
}
