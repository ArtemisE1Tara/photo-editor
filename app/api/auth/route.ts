import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { accessToken } = body;
    
    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token" }, { status: 400 });
    }
    
    // Call Google API to get user info
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    
    if (!userInfoResponse.ok) {
      return NextResponse.json(
        { error: "Failed to get user info" }, 
        { status: userInfoResponse.status }
      );
    }
    
    const userInfo = await userInfoResponse.json();
    
    return NextResponse.json({
      authenticated: true,
      user: userInfo
    });
  } catch (error) {
    console.error("Auth API error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}

// Also handle token validation
export async function GET(request: Request) {
  try {
    // Get the access token from the Authorization header
    const authHeader = request.headers.get("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
    
    const accessToken = authHeader.substring(7);
    
    // Validate the token with Google
    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`
    );
    
    if (!tokenInfoResponse.ok) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
    
    // Token is valid
    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
