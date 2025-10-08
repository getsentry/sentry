import type {PreventAIFeatureConfig, Sensitivity} from 'sentry/types/prevent';

describe('Prevent Types', () => {
  describe('Sensitivity', () => {
    it('should accept all valid sensitivity values', () => {
      const validSensitivities: Sensitivity[] = ['low', 'medium', 'high', 'critical'];

      validSensitivities.forEach(sensitivity => {
        expect(typeof sensitivity).toBe('string');
        expect(['low', 'medium', 'high', 'critical']).toContain(sensitivity);
      });
    });

    it('should be assignable to string but maintain type safety', () => {
      const lowSensitivity: Sensitivity = 'low';
      const mediumSensitivity: Sensitivity = 'medium';
      const highSensitivity: Sensitivity = 'high';
      const criticalSensitivity: Sensitivity = 'critical';

      expect(lowSensitivity).toBe('low');
      expect(mediumSensitivity).toBe('medium');
      expect(highSensitivity).toBe('high');
      expect(criticalSensitivity).toBe('critical');
    });
  });

  describe('PreventAIFeatureConfig with Sensitivity', () => {
    it('should accept sensitivity as optional Sensitivity type', () => {
      const configWithSensitivity: PreventAIFeatureConfig = {
        enabled: true,
        triggers: {
          on_command_phrase: false,
          on_ready_for_review: true,
        },
        sensitivity: 'high',
      };

      expect(configWithSensitivity.sensitivity).toBe('high');
    });

    it('should work without sensitivity field', () => {
      const configWithoutSensitivity: PreventAIFeatureConfig = {
        enabled: false,
        triggers: {
          on_command_phrase: true,
          on_ready_for_review: false,
        },
      };

      expect(configWithoutSensitivity.sensitivity).toBeUndefined();
    });

    it('should handle all sensitivity levels in feature config', () => {
      const sensitivityLevels: Sensitivity[] = ['low', 'medium', 'high', 'critical'];

      sensitivityLevels.forEach(sensitivity => {
        const config: PreventAIFeatureConfig = {
          enabled: true,
          triggers: {
            on_command_phrase: false,
            on_ready_for_review: false,
          },
          sensitivity,
        };

        expect(config.sensitivity).toBe(sensitivity);
      });
    });
  });
});
