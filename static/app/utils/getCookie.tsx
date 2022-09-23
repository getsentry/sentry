/**
 * Get the value of a cookie by name
 */
export default function getCookie(name: string): string | null {
  if (!document.cookie || document.cookie === '') {
    return null;
  }

  const cookies = document.cookie.split(';');
  const cookie = cookies.find(c => c.substring(0, name.length + 1) === `${name}=`);

  if (cookie === undefined) {
    return null;
  }

  return decodeURIComponent(cookie.trim().substring(name.length + 1));
}
