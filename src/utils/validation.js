const { z } = require('zod');

/**
 * Onboarding validation schema with strict rules
 */
const onboardingSchema = z.object({
    hearingStatus: z.enum(['deaf', 'hard_of_hearing', 'hearing', 'coda'], {
        required_error: 'Hearing status is required',
        invalid_type_error: 'Invalid hearing status value',
    }),
    lsmVariant: z.string().min(1, 'LSM variant is required'),
    ageRange: z.string().optional(),
    gender: z.string().optional(),
});

module.exports = {
    onboardingSchema,
};
