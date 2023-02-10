import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {LightFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {parseDroppedProfile} from 'sentry/utils/profiling/profile/importProfile';

export interface ProfileDragDropImportProps {
  children: React.ReactNode;
  onImport: (input: Profiling.ProfileInput) => void;
}

function ProfileDragDropImport({
  onImport,
  children,
}: ProfileDragDropImportProps): React.ReactElement {
  const [dropState, setDropState] = useState<
    'idle' | 'dragover' | 'processing' | 'errored'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onDrop = useCallback(
    (evt: React.DragEvent<HTMLDivElement>) => {
      evt.preventDefault();
      evt.stopPropagation();

      const file = evt.dataTransfer.items[0].getAsFile();

      if (file) {
        setDropState('processing');
        parseDroppedProfile(file)
          .then(profile => {
            setDropState('idle');
            setErrorMessage(null);

            onImport(profile);
          })
          .catch(e => {
            setDropState('errored');
            setErrorMessage(e.message);
          });
      }
    },
    [onImport]
  );

  const onDragEnter = useCallback((evt: React.DragEvent<HTMLDivElement>) => {
    evt.preventDefault();
    evt.stopPropagation();
    setDropState('dragover');
  }, []);

  const onDragLeave = useCallback((evt: React.DragEvent<HTMLDivElement>) => {
    evt.preventDefault();
    evt.stopPropagation();
    setDropState('idle');
  }, []);

  // This is required to indicate that onDrop is supported on this element
  const onDragOver = useCallback((evt: React.DragEvent<HTMLDivElement>) => {
    evt.preventDefault();
  }, []);

  const onDismiss = useCallback(() => {
    setDropState('idle');
    setErrorMessage(null);
  }, []);

  return (
    <DragDropContainer onDragEnter={onDragEnter}>
      {dropState === 'idle' ? null : dropState === 'errored' ? (
        <Overlay>
          {t('Failed to import profile with error')}
          <p>{errorMessage}</p>
          <div>
            <Button onClick={onDismiss}>{t('Dismiss')}</Button>
          </div>
        </Overlay>
      ) : (
        <Overlay onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
          {t('Drop profile here')}
        </Overlay>
      )}
      {children}
    </DragDropContainer>
  );
}

const DragDropContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 100%;
`;

const Overlay = styled('div')`
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: calc(100% - ${LightFlamegraphTheme.SIZES.TIMELINE_HEIGHT}px);
  display: grid;
  grid: auto/50%;
  place-content: center;
  z-index: ${p => p.theme.zIndex.modal};
  text-align: center;
  background-color: ${p => p.theme.surface200};
`;

export {ProfileDragDropImport};
