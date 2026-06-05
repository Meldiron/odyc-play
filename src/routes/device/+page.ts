import type { PageLoad } from './$types';
import { Backend } from '$lib/backend';
import { redirect } from '@sveltejs/kit';

export const ssr = false;

export const load: PageLoad = async ({ url }) => {
	const user = await Backend.getUserSafe();
	if (!user) {
		const returnTo = `/device${url.search}`;
		throw redirect(307, `/auth/sign-in?redirect=${encodeURIComponent(returnTo)}`);
	}

	// A user who signs in mid-flow (e.g. Email OTP) won't have passed through the
	// dashboard layout that creates their profile. Ensure it exists before binding
	// a grant, mirroring the consent screen.
	await Backend.ensureProfile(user);

	// RFC 8628 verification_uri_complete carries the code as `user_code`. Pre-fill
	// it, but the user must still submit explicitly (§3.3.1) — never auto-submit.
	// The code is always 6 digits, so strip any formatting (e.g. the display hyphen)
	// and keep only digits.
	const userCode = (url.searchParams.get('user_code') ?? '').replace(/\D/g, '').slice(0, 6);

	return { userCode };
};
