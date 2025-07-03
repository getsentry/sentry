import {useCallback, useEffect, useRef, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t, tct} from 'sentry/locale';

const ALLOWED_MIMETYPES = 'image/gif,image/jpeg,image/png';

interface UseUploaderOptions {
  minImageSize: number;
  onSelect: (objectUrl: string) => void;
}

export function useUploader({onSelect, minImageSize}: UseUploaderOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const cleanupObjectUrl = useCallback(() => {
    if (objectUrl) {
      window.URL.revokeObjectURL(objectUrl);
    }
  }, [objectUrl]);

  useEffect(() => () => cleanupObjectUrl(), [cleanupObjectUrl]);

  const openUpload = useCallback((ev: React.MouseEvent<HTMLElement>) => {
    ev.currentTarget.blur();
    ev.preventDefault();
    fileInputRef.current?.click();
  }, []);

  const validateSize = useCallback(
    (height: number, width: number) => {
      if (width >= minImageSize && height >= minImageSize) {
        return true;
      }

      return tct('Your image must be larger than [size]px by [size]px.', {
        size: minImageSize - 1,
      });
    },
    [minImageSize]
  );

  const onSelectFile = useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];

      // No file selected (e.g. user clicked "cancel")
      if (!file) {
        return;
      }

      if (!/^image\//.test(file.type)) {
        addErrorMessage(t('That is not a supported file type.'));
        return;
      }
      const url = window.URL.createObjectURL(file);
      const {height, width} = await getImageHeightAndWidth(url);
      const sizeValidation = validateSize(height, width);

      if (sizeValidation !== true) {
        addErrorMessage(sizeValidation);
        return;
      }

      setObjectUrl(url);
      onSelect(url);
      ev.target.value = '';
    },
    [onSelect, validateSize]
  );

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      style={{display: 'none'}}
      accept={ALLOWED_MIMETYPES}
      onChange={onSelectFile}
    />
  );

  return {fileInput, openUpload, objectUrl};
}

function getImageHeightAndWidth(dataURL: string) {
  return new Promise<{height: number; width: number}>((resolve, reject) => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const {height, width} = img;
      resolve({height, width});
    };
    img.src = dataURL;
  });
}
