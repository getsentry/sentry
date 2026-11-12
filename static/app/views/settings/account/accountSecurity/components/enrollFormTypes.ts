type TotpEnrollValue = {
  otp: string;
};

type SmsEnrollValue = {
  otp: string;
  phone: string;
};

type WebAuthnEnrollValue = {
  challenge: string;
  deviceName: string;
  response: string;
};

export type EnrollPayload =
  | (TotpEnrollValue & {secret: string})
  | (Omit<SmsEnrollValue, 'otp'> & {secret: string; otp?: string})
  | WebAuthnEnrollValue;
