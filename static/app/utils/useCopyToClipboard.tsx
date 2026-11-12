import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';

type CopyCallback = (
  text: string,
  /**
   * Optional options to customize the copy operation.
   * @default {successMessage: t('Copied to clipboard'), errorMessage: t('Error copying to clipboard')}
   * Pass `null` to disable any toast messages.
   */
  options?: {errorMessage?: React.ReactNode; successMessage?: React.ReactNode} | null
) => Promise<string | void>;

export function copyToClipboard(
  text: string,
  /**
   * Optional options to customize the copy operation.
   * @default {successMessage: t('Copied to clipboard'), errorMessage: t('Error copying to clipboard')}
   * Pass `null` to disable any toast messages.
   */
  options?: {errorMessage?: React.ReactNode; successMessage?: React.ReactNode} | null
) {
  const successMessage =
    options === null ? undefined : (options?.successMessage ?? t('Copied to clipboard'));
  const errorMessage =
    options === null
      ? undefined
      : (options?.errorMessage ?? t('Error copying to clipboard'));

  const promise = navigator.clipboard
    .writeText(text)
    .then(() => {
      if (successMessage) {
        toast.success(successMessage);
      }
      return text;
    })
    .catch(_error => {
      if (errorMessage) {
        toast.error(errorMessage);
      }
    });

  return promise;
}

export function useCopyToClipboard(): {copy: CopyCallback} {
  return {
    copy: copyToClipboard,
  };
}
