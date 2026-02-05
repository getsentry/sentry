import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';

type CopyCallback = (
  text: string,
  /**
   * Optional options to customize the copy operation.
   * @default {successMessage: t('Copied to clipboard'), errorMessage: t('Error copying to clipboard')}
   * Pass `null` to disable any toast messages.
   */
  options?: {errorMessage?: React.ReactNode; successMessage?: React.ReactNode} | null
) => Promise<string>;

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
        addSuccessMessage(successMessage);
      }
      return text;
    })
    .catch(error => {
      if (errorMessage) {
        addErrorMessage(errorMessage);
      }
      throw error;
    });

  return promise;
}

export default function useCopyToClipboard(): {copy: CopyCallback} {
  return {
    copy: copyToClipboard,
  };
}
