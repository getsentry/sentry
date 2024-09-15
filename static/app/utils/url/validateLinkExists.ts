import {t} from 'sentry/locale';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';

/**
 * Checks if a URL exists by sending a HEAD request.
 * @param url - The URL to check.
 * @returns A promise that resolves to `true` if the URL exists, or `false` otherwise.
 */
export async function validateLinkExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {method: 'HEAD'}); // Using HEAD method to just check if the resource exists
    if (response.ok) {
      return true;
    }
    return false;
  } catch (error) {
    handleXhrErrorResponse(t('Unable to validate if the link exists'), error);
    return false;
  }
}
