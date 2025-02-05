const API_SIGNIN = 'https://adam-jerusalem.nd.edu/api/auth/signin';
const API_GRAPHQL = 'https://adam-jerusalem.nd.edu/api/graphql-engine/v1/graphql';

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const credentials = btoa(`${username}:${password}`);


    try {
        const response = await axios.post(API_SIGNIN, null, {
            headers: { 'Authorization': `Basic ${credentials}` }
        });

        const token = response.data;
        if (!token || token.split('.').length !== 3) throw new Error('Invalid JWT');
        
    
        localStorage.setItem('jwt', token);
        localStorage.setItem('username', username);
        await loadProfile(); 

        document.getElementById('login-box').style.display = 'none';
        document.getElementById('profile-box').style.display = 'block';
        
    } catch (error) {
        console.error('Login failed:', error);
        document.getElementById('error-msg').textContent = 'Login failed';
    }
}

async function loadProfile() {
    document.getElementById('login-box').classList.add('hidden');
    document.getElementById('profile-box').classList.remove('hidden');

    try {
        const token = localStorage.getItem('jwt');
        if (!token) throw new Error('No JWT token found in localStorage');

        const query = `{
            user {
                id
                firstName
                lastName
                auditRatio
                xps {
                    amount
                    path
                }
                groups{
                    id
                }
            }
            transaction {
                type
                amount
                createdAt
            }
        }`;

        const response = await axios.post(API_GRAPHQL, { query }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('GraphQL response:', response.data);

        const user = response.data?.data?.user?.[0];
        const transactions = response.data?.data?.transaction || [];

        if (!user) throw new Error('User data not available');

        document.getElementById('welcome-msg').textContent = `Welcome, ${user.firstName || localStorage.getItem('username')}!`;

        let piscineGoXP = user.xps
            .filter(xp => xp.path.startsWith('/adam/piscine-go/'))
            .reduce((sum, xp) => sum + (xp.amount || 0), 0) / 1000;

        let piscineJavaXP = user.xps
            .filter(xp => xp.path.startsWith('/adam/module/piscine-js/'))
            .reduce((sum, xp) => sum + (xp.amount || 0), 0) / 1000;
        

        let highestSkillProg = transactions
            .filter(tx => tx.type === 'skill_prog')
            .reduce((max, tx) => Math.max(max, tx.amount), 0);
            

        document.getElementById('user-info').innerHTML = `
        <h4>ID: ${user.id}</h4>
        <h4>Groups: ${user.groups.length}</h4>
        <h4>Name: ${user.firstName} ${user.lastName}</h4>
        <h4>Audit Ratio: ${user.auditRatio}</h4>
        <h4>Total XP from Piscine-Go: ${piscineGoXP.toFixed(2)} KB</h4>
        <h4>Total XP from Piscine-JS: ${piscineJavaXP.toFixed(2)} KB</h4>
        <h4>Total XP from module: ${calculateTotalXP(user.xps)}%</h4>
        <h4>Highest Checkpoint Level: ${highestSkillProg}%</h4>
`;


        console.log('User XP data:', user.xps);
        console.log('Transaction data:', transactions);


        createPieChart(transactions);
        createLineChart(user.xps);

        // document.getElementById('charts-container').style.display = 'flex';

    } catch (error) {
        console.error('Error loading profile:', error);
        // document.getElementById('user-info').innerHTML = '<p style="color: red;">Error loading data</p>';
    }
}


function calculateTotalXP(xps) {
    const modulePathRegex = /module(?!\/piscine)/i;
    const totalModuleXp = xps
        .filter(xp => modulePathRegex.test(xp.path))
        .reduce((sum, xp) => sum + xp.amount, 0);

    return ((totalModuleXp + 70000) / 1000).toFixed(0); 
}

function createPieChart(transactions) {
    const skills = ['go', 'html', 'js', 'sql', 'css'];

    const skillData = transactions
        .filter(tx => tx.type.startsWith('skill_')) 
        .reduce((acc, tx) => {
            const skillType = tx.type.replace('skill_', ''); 
            if (skills.includes(skillType)) {
                acc[skillType] = Math.max(acc[skillType] || 0, tx.amount); 
            }
            return acc;
        }, {});

    console.log('Skill data for pie chart:', skillData); 

    if (Object.keys(skillData).length === 0) {
        document.getElementById('skillPieChart').innerHTML = "<p>No skill data available</p>";
        return;
    }
 const ctx = document.getElementById('skillPieChart').getContext('2d');
    const labels = Object.keys(skillData);
    const data = Object.values(skillData);

   

    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(255, 105, 180, 0.6)', 
                    'rgba(255, 20, 147, 0.6)',  
                    'rgba(255, 182, 193, 0.6)', 
                    'rgba(255, 160, 122, 0.6)', 
                    'rgba(255, 215, 0, 0.6)',   
                ],
                borderColor: [
                    'rgba(255, 105, 180, 1)',   
                    'rgba(255, 20, 147, 1)',    
                    'rgba(255, 182, 193, 1)',  
                    'rgba(255, 160, 122, 1)',   
                    'rgba(255, 215, 0, 1)',    
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(tooltipItem) {
                            const label = tooltipItem.label;
                            const value = tooltipItem.raw;
                            return `${label}: ${value}`;
                        }
                    }
                }
            }
        }
    });
}

// CSS to resize the pie chart
const style = document.createElement('style');
style.innerHTML = `
    #skillPieChart {
        max-width: 40٪;  /* Set the max width */
        max-height: 400px; /* Set the max height */
        width: 100%;  
        height: auto;  
    }
`;
document.head.appendChild(style);


// Add line chart function
function createLineChart(xps) {
    if (!Array.isArray(xps) || xps.length === 0) {
        console.error("No XP data available for line chart.");
        return;
    }

    const projectXP = xps.reduce((acc, xp) => {
        if (xp.path.startsWith('/adam/module/piscine-js/')) {
            acc['Piscine-Java'] = (acc['Piscine-Java'] || 0) + xp.amount;
        } else if (xp.path.startsWith('/adam/piscine-go/')) {
            acc['Piscine-Go'] = (acc['Piscine-Go'] || 0) + xp.amount;
        } else {
            acc['Module'] = (acc['Module'] || 0) + xp.amount;
        }
        return acc;
    }, {});

    if (Object.keys(projectXP).length === 0) {
        console.warn("No relevant XP data for line chart.");
        return;
    }

    const labels = Object.keys(projectXP);
    const data = Object.values(projectXP);

    const chartContainer = document.createElement('div');
    chartContainer.style.position = 'relative';
    chartContainer.style.width = '40%';
    chartContainer.style.height = '300px';
    chartContainer.style.margin = '10px';
    document.body.appendChild(chartContainer);

    var canvas = document.createElement('canvas');
    chartContainer.appendChild(canvas);

    if (Object.keys(projectXP).length === 0) {
        document.getElementById('xplineChart').innerHTML = "<p>No skill data available</p>";
        return;
    }
 const ctx = document.getElementById('xplineChart').getContext('2d');
    // var ctx = canvas.getContext('2d');

    var myLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total XP per Project',
                data: data,
                borderColor: 'rgba(255, 105, 180, 1)',
                backgroundColor: 'rgba(255, 182, 193, 0.2)',
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    canvas.width = chartContainer.offsetWidth;
    canvas.height = chartContainer.offsetHeight;
}


// Call the function to create the chart
createLineChart();


function logout() {
    // localStorage.clear();
    document.getElementById('login-box').style.display = 'block';
    document.getElementById('profile-box').style.display = 'none';
}


if (localStorage.getItem('jwt')) loadProfile();