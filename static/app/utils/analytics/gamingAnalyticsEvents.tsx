type GamingPlatformBase = {
  origin: 'onboarding' | 'project-creation' | 'project-settings' | 'org-settings';
  platform?: string;
};

export type GamingAnalyticsEventParameters = {
  'gaming.partner_request_access_guidance_modal_button_got_it_clicked': GamingPlatformBase;
  'gaming.partner_request_access_guidance_modal_opened': GamingPlatformBase;
  'gaming.private_sdk_access_modal_opened': GamingPlatformBase & {
    project_id?: string;
  };
  'gaming.private_sdk_access_modal_submitted': GamingPlatformBase & {
    platforms: string[];
    project_id?: string;
  };
};

export const gamingEventMap: Record<keyof GamingAnalyticsEventParameters, string> = {
  'gaming.partner_request_access_guidance_modal_opened':
    'Gaming: Partner Request Access Guidance Modal Opened',
  'gaming.partner_request_access_guidance_modal_button_got_it_clicked':
    'Gaming: Partner Request Access Guidance Modal Button Got It Clicked',
  'gaming.private_sdk_access_modal_submitted':
    'Gaming: Private SDK Access Modal Submitted',
  'gaming.private_sdk_access_modal_opened': 'Gaming: Private SDK Access Modal Opened',
};
