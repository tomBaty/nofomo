import { useEffect } from 'react';

export function GoogleSignIn({ setUserProfile, userProfile }) {
    useEffect(() => {
        function decodeJWT(token) {
            let base64Url = token.split(".")[1];
            let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
            let jsonPayload = decodeURIComponent(
                atob(base64)
                    .split("")
                    .map(function (c) {
                        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
                    })
                    .join("")
            );
            return JSON.parse(jsonPayload);
        }

        let handleCredentialResponse = (response) => {
            const decoded = decodeJWT(response.credential);
            setUserProfile(decoded);
            localStorage.setItem("googleUserProfile", JSON.stringify(decoded));
            console.log(decoded);
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