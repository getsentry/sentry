import * as React from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {
  importDroppedProfile,
  ProfileGroup,
} from 'sentry/utils/profiling/profile/importProfile';

interface ProfileImportProps {
  children: React.ReactNode;
  onImport: (profile: ProfileGroup) => void;
}

function ProfileDragDropImport({
  onImport,
  children,
}: ProfileImportProps): React.ReactElement {
  const [dropState, setDropState] = React.useState<'idle' | 'dragover' | 'processing'>(
    'idle'
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const onDrop = React.useCallback(
    (evt: React.DragEvent<HTMLDivElement>) => {
      evt.preventDefault();
      evt.stopPropagation();

      const file = evt.dataTransfer.items[0].getAsFile();

      if (file) {
        setDropState('processing');
        importDroppedProfile(file)
          .then(profile => {
            setDropState('idle');
            setErrorMessage(null);

            onImport(profile);
          })
          .catch(e => {
            setDropState('idle');
            setErrorMessage(e.message);
          });
      }
    },
    [onImport]
  );

  const onDragEnter = React.useCallback((evt: React.DragEvent<HTMLDivElement>) => {
    evt.preventDefault();
    evt.stopPropagation();
    setDropState('dragover');
  }, []);

  const onDragLeave = React.useCallback((evt: React.DragEvent<HTMLDivElement>) => {
    evt.preventDefault();
    evt.stopPropagation();
    setDropState('idle');
  }, []);

  // This is required to indicate that onDrop is supported on this element
  const onDragOver = React.useCallback((evt: React.DragEvent<HTMLDivElement>) => {
    evt.preventDefault();
  }, []);

  return (
    <div onDragEnter={onDragEnter}>
      {dropState === 'idle' ? null : (
        <Overlay onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
          {t('Drop here')}
          <p>{errorMessage}</p>
        </Overlay>
      )}
      {children}
    </div>
  );
}

const Overlay = styled('div')`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: grid;
  grid: auto/50%;
  place-content: center;
  z-index: ${p => p.theme.zIndex.modal};
  text-align: center;
`;

export {ProfileDragDropImport};
