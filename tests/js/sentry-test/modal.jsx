import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import GlobalModal from 'app/components/globalModal';

export async function mountGlobalModal(context) {
  const modal = mountWithTheme(<GlobalModal />, context);
  await tick();
  modal.update();

  return modal;
}
