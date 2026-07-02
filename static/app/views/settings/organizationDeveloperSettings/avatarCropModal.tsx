import {Fragment, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {AvatarCropper} from 'sentry/components/avatarChooser/avatarCropper';
import {t} from 'sentry/locale';

interface AvatarCropModalProps extends ModalRenderProps {
  dataUrl: string;
  maxDimension: number;
  minDimension: number;
  onCrop: (dataUrl: string) => void;
}

export function AvatarCropModal({
  Header,
  Body,
  Footer,
  closeModal,
  dataUrl,
  minDimension,
  maxDimension,
  onCrop,
}: AvatarCropModalProps) {
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null);

  return (
    <Fragment>
      <Header closeButton>{t('Crop your image')}</Header>
      <Body>
        <AvatarCropper
          minDimension={minDimension}
          maxDimension={maxDimension}
          dataUrl={dataUrl}
          updateDataUrlState={setCroppedDataUrl}
        />
      </Body>
      <Footer>
        <Flex gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            variant="primary"
            disabled={!croppedDataUrl}
            onClick={() => {
              if (croppedDataUrl) {
                onCrop(croppedDataUrl);
              }
              closeModal();
            }}
          >
            {t('Save image')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}
