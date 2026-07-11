import { useEffect } from 'react';

export function GoogleSignIn({ setUserProfile, userProfile, setFavourites, setVisited }) {
    useEffect(() => {
        let handleCredentialResponse = async (response) => {
            try {
                // Diagnostic: inspect the JWT header without leaking the full token
                try {
                    const [headerB64] = response.credential.split('.');
                    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));
                    console.log('Google credential JWT header:', header);
                } catch (e) {
                    console.log('Credential is not a standard JWT:', response.credential?.slice(0, 20));
                }

                // Send the raw Google ID token to internal API where it can be verified, and any user data in storage fetched
                const res = await fetch('/api/user', {
                    headers: {
                        Authorization: `Bearer ${response.credential}`
                    }
                });

                if (!res.ok) {
                    throw new Error(`Sign-in verification failed with status ${res.status}`);
                }

                const data = await res.json();
                // Keep the raw ID token around so we can authenticate follow-up
                // calls (e.g. syncing favourites/visited) without asking the
                // user to sign in again. Note: Google ID tokens expire after
                // ~1 hour, so sync calls made after that will need a fresh sign-in.
                const profileWithToken = { ...data, idToken: response.credential };
                setUserProfile(profileWithToken);
                localStorage.setItem("googleUserProfile", JSON.stringify(profileWithToken));

                if(profileWithToken.userData?.favourites) {
                    localStorage.setItem("favourites", JSON.stringify(profileWithToken.userData.favourites));
                    setFavourites(profileWithToken.userData.favourites);
                }
                if(profileWithToken.userData?.visited) {
                    localStorage.setItem("visited", JSON.stringify(profileWithToken.userData.visited));
                    setVisited(profileWithToken.userData.visited);
                }
            } catch (error) {
                console.error('Google sign-in failed:', error);
            }
        }
        google.accounts.id.initialize({
            client_id: "797883913821-9qtpse6mbboe6rh4b62rjhlj47mjddqb.apps.googleusercontent.com",
            callback: handleCredentialResponse
        });

        google.accounts.id.renderButton(
            document.querySelector(".g_id_signin"),
            { theme: "filled_black", size: "large", shape: "pill", width: "200" }  // customization attributes
        );
    }, [setUserProfile, userProfile])

    return <div className="g_id_signin"></div>
}