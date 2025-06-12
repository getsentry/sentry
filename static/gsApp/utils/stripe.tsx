/**
 * Ensures Stripe JS is only loaded once
 */
export const loadStripe = (onload?: (stripe: any) => void) => {
  // its likely already loaded at this point as its hooked in
  // our standard layout.html
  if ('Stripe' in window) {
    return onload?.(window.Stripe);
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://js.stripe.com/v3/';
  script.onload = () => {
    document.body.removeChild(script);
    onload?.(window.Stripe);
  };

  return void document.body.appendChild(script);
};
